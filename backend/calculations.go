package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
)

const maxCalculationRequestBytes = 1 << 20

type requestToken struct {
	Type  string          `json:"type"`
	Value json.RawMessage `json:"value"`
}

// token contains a validated value ready for evaluation.
type token struct {
	kind   string
	number float64
	symbol string
}

type calculationRequest struct {
	Tokens []requestToken `json:"tokens"`
}

type calculationError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"-"`
}

func (e *calculationError) Error() string { return e.Message }

func invalidTokens(message string) *calculationError {
	return &calculationError{Code: "invalid_tokens", Message: message, Status: http.StatusBadRequest}
}

func writeCalculationError(w http.ResponseWriter, err *calculationError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Status)
	_ = json.NewEncoder(w).Encode(map[string]*calculationError{"error": err})
}

func handleCalculation(w http.ResponseWriter, r *http.Request) {
	request, err := decodeCalculationRequest(http.MaxBytesReader(w, r.Body, maxCalculationRequestBytes))
	if err != nil {
		writeCalculationError(w, err)
		return
	}
	tokens, err := validateTokens(request.Tokens)
	if err != nil {
		writeCalculationError(w, err)
		return
	}
	result, err := evaluateTokens(tokens)
	if err != nil {
		writeCalculationError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(struct {
		Result float64 `json:"result"`
	}{Result: result})
}

func decodeCalculationRequest(body io.Reader) (calculationRequest, *calculationError) {
	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()
	var request calculationRequest
	if err := decoder.Decode(&request); err != nil {
		return calculationRequest{}, invalidTokens("Invalid JSON request: " + err.Error())
	}
	var extra any
	if err := decoder.Decode(&extra); err != io.EOF {
		return calculationRequest{}, invalidTokens("Expected one JSON request object")
	}
	return request, nil
}

func validateTokens(input []requestToken) ([]token, *calculationError) {
	if len(input) == 0 {
		return nil, invalidTokens("tokens must be a non-empty array")
	}
	tokens := make([]token, len(input))
	for i, raw := range input {
		current := token{kind: raw.Type}
		switch raw.Type {
		case "number":
			// JSON null unmarshals into a float64 without an error.
			if string(raw.Value) == "null" {
				return nil, invalidTokens(fmt.Sprintf("Token %d must contain a finite number", i))
			}
			if err := json.Unmarshal(raw.Value, &current.number); err != nil || !isFinite(current.number) {
				return nil, invalidTokens(fmt.Sprintf("Token %d must contain a finite number", i))
			}
		case "operator", "parenthesis":
			if err := json.Unmarshal(raw.Value, &current.symbol); err != nil {
				return nil, invalidTokens(fmt.Sprintf("Token %d must contain a string", i))
			}
			if raw.Type == "operator" {
				switch current.symbol {
				case "+", "-", "*", "/":
				default:
					return nil, invalidTokens(fmt.Sprintf("Token %d has an invalid operator", i))
				}
			} else if current.symbol != "(" && current.symbol != ")" {
				return nil, invalidTokens(fmt.Sprintf("Token %d has an invalid parenthesis", i))
			}
		default:
			return nil, invalidTokens(fmt.Sprintf("Token %d has an invalid type", i))
		}
		tokens[i] = current
	}
	return tokens, nil
}

func evaluateTokens(tokens []token) (float64, *calculationError) {
	parser := calculationParser{tokens: tokens}
	result, err := parser.parseExpression()
	if err != nil {
		return 0, err
	}
	if parser.position != len(parser.tokens) {
		return 0, invalidTokens(fmt.Sprintf("Unexpected token at position %d", parser.position))
	}
	return result, nil
}

func isFinite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

// Grammar (operators at each level associate left to right):
// expression = term { ("+" | "-") term }
// term       = factor { ("*" | "/") factor }
// factor     = number | "(" expression ")"
type calculationParser struct {
	tokens   []token
	position int
}

func (p *calculationParser) matchesOperator(first, second string) bool {
	if p.position >= len(p.tokens) {
		return false
	}
	current := p.tokens[p.position]
	return current.kind == "operator" && (current.symbol == first || current.symbol == second)
}

func (p *calculationParser) consumeParenthesis(symbol string) bool {
	if p.position >= len(p.tokens) {
		return false
	}
	current := p.tokens[p.position]
	if current.kind != "parenthesis" || current.symbol != symbol {
		return false
	}
	p.position++
	return true
}

func (p *calculationParser) parseExpression() (float64, *calculationError) {
	result, err := p.parseTerm()
	if err != nil {
		return 0, err
	}
	for p.matchesOperator("+", "-") {
		op := p.tokens[p.position].symbol
		p.position++
		right, err := p.parseTerm()
		if err != nil {
			return 0, err
		}
		result, err = applyOperator(result, right, op)
		if err != nil {
			return 0, err
		}
	}
	return result, nil
}

func (p *calculationParser) parseTerm() (float64, *calculationError) {
	result, err := p.parseFactor()
	if err != nil {
		return 0, err
	}
	for p.matchesOperator("*", "/") {
		op := p.tokens[p.position].symbol
		p.position++
		right, err := p.parseFactor()
		if err != nil {
			return 0, err
		}
		result, err = applyOperator(result, right, op)
		if err != nil {
			return 0, err
		}
	}
	return result, nil
}

func (p *calculationParser) parseFactor() (float64, *calculationError) {
	if p.position >= len(p.tokens) {
		return 0, invalidTokens("Missing operand")
	}
	current := p.tokens[p.position]
	p.position++
	if current.kind == "number" {
		return current.number, nil
	}
	if current.kind == "parenthesis" && current.symbol == "(" {
		result, err := p.parseExpression()
		if err != nil {
			return 0, err
		}
		if !p.consumeParenthesis(")") {
			return 0, invalidTokens("Unmatched opening parenthesis")
		}
		return result, nil
	}
	return 0, invalidTokens(fmt.Sprintf("Expected a number or opening parenthesis at position %d", p.position-1))
}

func applyOperator(left, right float64, op string) (float64, *calculationError) {
	var result float64
	switch op {
	case "+":
		result = left + right
	case "-":
		result = left - right
	case "*":
		result = left * right
	case "/":
		if right == 0 {
			return 0, &calculationError{Code: "division_by_zero", Message: "Division by zero", Status: http.StatusUnprocessableEntity}
		}
		result = left / right
	default:
		return 0, invalidTokens("Invalid operator")
	}
	if !isFinite(result) {
		return 0, &calculationError{Code: "non_finite_result", Message: "Calculation produced a non-finite result", Status: http.StatusUnprocessableEntity}
	}
	return result, nil
}
