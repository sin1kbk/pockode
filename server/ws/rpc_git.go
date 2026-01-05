package ws

import (
	"context"
	"errors"
	"strings"

	"github.com/pockode/server/contents"
	"github.com/pockode/server/git"
	"github.com/pockode/server/rpc"
	"github.com/sourcegraph/jsonrpc2"
)

func (h *rpcMethodHandler) handleGitStatus(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) {
	status, err := git.Status(h.workDir)
	if err != nil {
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInternalError, err.Error())
		return
	}

	response := rpc.GitStatusResult{
		Staged:   status.Staged,
		Unstaged: status.Unstaged,
	}

	if err := conn.Reply(ctx, req.ID, response); err != nil {
		h.log.Error("failed to send git status response", "error", err)
	}
}

func (h *rpcMethodHandler) handleGitDiff(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) {
	var params rpc.GitDiffParams
	if err := unmarshalParams(req, &params); err != nil {
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, "invalid params")
		return
	}

	if params.Path == "" {
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, "path required")
		return
	}

	if err := contents.ValidatePath(h.workDir, params.Path); err != nil {
		if errors.Is(err, contents.ErrInvalidPath) {
			h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, "invalid path")
			return
		}
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInternalError, err.Error())
		return
	}

	result, err := git.DiffWithContent(h.workDir, params.Path, params.Staged)
	if err != nil {
		if strings.Contains(err.Error(), "file not found") {
			h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, err.Error())
			return
		}
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInternalError, err.Error())
		return
	}

	response := rpc.GitDiffResult{
		Diff:       result.Diff,
		OldContent: result.OldContent,
		NewContent: result.NewContent,
	}

	if err := conn.Reply(ctx, req.ID, response); err != nil {
		h.log.Error("failed to send git diff response", "error", err)
	}
}
