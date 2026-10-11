package main

import (
	"errors"
	"strings"

	"github.com/LLGGJ/venix-cli/internal/output"
)

var errNotLoggedIn = errors.New("não logado")

func isAuthError(err error) bool {
	return errors.Is(err, errNotLoggedIn) || strings.Contains(err.Error(), "UNAUTHORIZED")
}

func isNetworkError(message string) bool {
	for _, marker := range []string{"dial tcp", "no such host", "i/o timeout", "connection refused", "network is unreachable", "context deadline exceeded", "TLS handshake", "connection reset"} {
		if strings.Contains(message, marker) {
			return true
		}
	}
	return false
}

// reportError mostra o erro de forma amigável. args são os argumentos do comando
// que falhou, usados para sugerir "use o comando novamente".
func reportError(err error, args []string) {
	retry := strings.TrimSpace("venix " + strings.Join(args, " "))
	switch {
	case errors.Is(err, errNotLoggedIn):
		output.Error("Você ainda não fez login.")
		output.Info("Primeiro use o comando: venix login")
		output.Info("Depois use o comando novamente: " + retry)
	case isAuthError(err):
		output.Error("Sua sessão expirou ou foi recusada.")
		output.Info("Primeiro use o comando: venix login")
		output.Info("Depois use o comando novamente: " + retry)
	case strings.Contains(err.Error(), "HTTP_429"):
		output.Error("A VenixCloud limitou as requisições (muitas em pouco tempo).")
		output.Info("Aguarde alguns segundos e use o comando novamente: " + retry)
	case strings.Contains(err.Error(), "ROUTE_NOT_FOUND"):
		output.Error("Esta função ainda não está disponível na API da VenixCloud.")
		output.Muted(err.Error())
	case isNetworkError(err.Error()):
		output.Error("Não consegui falar com a VenixCloud.")
		output.Info("Confira sua internet e use o comando novamente: " + retry)
	default:
		output.Error("erro: " + err.Error())
	}
}
