package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCalculations(t *testing.T) {
	tests := []struct {
		name, body, code string
		status           int
		result           float64
	}{
		{"precedence", `{"tokens":[{"type":"number","value":2},{"type":"operator","value":"+"},{"type":"number","value":2},{"type":"operator","value":"*"},{"type":"number","value":5}]}`, "", 200, 12},
		{"nested parentheses", `{"tokens":[{"type":"number","value":2},{"type":"operator","value":"+"},{"type":"parenthesis","value":"("},{"type":"number","value":5},{"type":"operator","value":"+"},{"type":"number","value":5},{"type":"operator","value":"*"},{"type":"parenthesis","value":"("},{"type":"number","value":2},{"type":"operator","value":"+"},{"type":"number","value":2},{"type":"parenthesis","value":")"},{"type":"parenthesis","value":")"}]}`, "", 200, 27},
		{"left associativity", `{"tokens":[{"type":"number","value":20},{"type":"operator","value":"/"},{"type":"number","value":2},{"type":"operator","value":"*"},{"type":"number","value":5}]}`, "", 200, 50},
		{"negative decimal", `{"tokens":[{"type":"number","value":-1.5},{"type":"operator","value":"-"},{"type":"number","value":2.25}]}`, "", 200, -3.75},
		{"single number", `{"tokens":[{"type":"number","value":7}]}`, "", 200, 7},
		{"empty", `{"tokens":[]}`, "invalid_tokens", 400, 0},
		{"invalid operator", `{"tokens":[{"type":"number","value":1},{"type":"operator","value":"^"},{"type":"number","value":2}]}`, "invalid_tokens", 400, 0},
		{"null number", `{"tokens":[{"type":"number","value":null}]}`, "invalid_tokens", 400, 0},
		{"missing operand", `{"tokens":[{"type":"number","value":1},{"type":"operator","value":"+"}]}`, "invalid_tokens", 400, 0},
		{"extra operand", `{"tokens":[{"type":"number","value":1},{"type":"number","value":2}]}`, "invalid_tokens", 400, 0},
		{"unmatched open", `{"tokens":[{"type":"parenthesis","value":"("},{"type":"number","value":1}]}`, "invalid_tokens", 400, 0},
		{"unmatched close", `{"tokens":[{"type":"number","value":1},{"type":"parenthesis","value":")"}]}`, "invalid_tokens", 400, 0},
		{"divide by zero", `{"tokens":[{"type":"number","value":1},{"type":"operator","value":"/"},{"type":"number","value":0}]}`, "division_by_zero", 422, 0},
		{"overflow", `{"tokens":[{"type":"number","value":1e308},{"type":"operator","value":"*"},{"type":"number","value":10}]}`, "non_finite_result", 422, 0},
		{"bad JSON", `{"tokens":`, "invalid_tokens", 400, 0},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			newHandler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/calculations", strings.NewReader(test.body)))
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d; body = %s", response.Code, test.status, response.Body.String())
			}
			if got := response.Header().Get("Content-Type"); got != "application/json" {
				t.Fatalf("content type = %q", got)
			}
			if test.code == "" {
				var body struct {
					Result float64 `json:"result"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Result != test.result {
					t.Fatalf("result = %v, error = %v; want %v", body.Result, err, test.result)
				}
			} else {
				var body struct {
					Error struct{ Code, Message string } `json:"error"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || body.Error.Code != test.code || body.Error.Message == "" {
					t.Fatalf("error body = %s, decode error = %v", response.Body.String(), err)
				}
			}
		})
	}
}

func TestCalculationsAreIndependent(t *testing.T) {
	handler := newHandler()
	for _, value := range []int{3, 9, 3} {
		response := httptest.NewRecorder()
		body := fmt.Sprintf(`{"tokens":[{"type":"number","value":%d}]}`, value)
		handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/calculations", strings.NewReader(body)))
		var got struct {
			Result int `json:"result"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &got); err != nil || got.Result != value {
			t.Fatalf("response = %s; want %d", response.Body.String(), value)
		}
	}
}

func TestCalculationValidationMessages(t *testing.T) {
	tests := []struct {
		name, body, message string
	}{
		{"missing tokens", "{}", "tokens must be a non-empty array"},
		{"null request", "null", "tokens must be a non-empty array"},
		{"multiple objects", "{} {}", "Expected one JSON request object"},
		{"trailing garbage", "{} x", "Expected one JSON request object"},
		{"unknown request field", `{"unexpected":true}`, `Invalid JSON request: json: unknown field "unexpected"`},
		{"unknown token field", `{"tokens":[{"type":"number","value":1,"unexpected":true}]}`, `Invalid JSON request: json: unknown field "unexpected"`},
		{"missing number", `{"tokens":[{"type":"number"}]}`, "Token 0 must contain a finite number"},
		{"string number", `{"tokens":[{"type":"number","value":"1"}]}`, "Token 0 must contain a finite number"},
		{"overflowing number", `{"tokens":[{"type":"number","value":1e999}]}`, "Token 0 must contain a finite number"},
		{"numeric operator", `{"tokens":[{"type":"operator","value":1}]}`, "Token 0 must contain a string"},
		{"null operator", `{"tokens":[{"type":"operator","value":null}]}`, "Token 0 has an invalid operator"},
		{"invalid parenthesis", `{"tokens":[{"type":"parenthesis","value":"["}]}`, "Token 0 has an invalid parenthesis"},
		{"invalid type", `{"tokens":[{"type":"unknown","value":1}]}`, "Token 0 has an invalid type"},
		{"oversized request", `{"tokens":[{"type":"number","value":"` + strings.Repeat("1", 1<<20) + `"}]}`, "Invalid JSON request: http: request body too large"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			newHandler().ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/calculations", strings.NewReader(test.body)))
			var body struct {
				Error calculationError `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}
			if response.Code != http.StatusBadRequest || body.Error.Code != "invalid_tokens" || body.Error.Message != test.message {
				t.Fatalf("status = %d, body = %s; want 400, invalid_tokens, %q", response.Code, response.Body.String(), test.message)
			}
		})
	}
}
