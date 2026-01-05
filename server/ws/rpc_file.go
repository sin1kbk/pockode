package ws

import (
	"context"
	"errors"

	"github.com/pockode/server/contents"
	"github.com/pockode/server/rpc"
	"github.com/sourcegraph/jsonrpc2"
)

func (h *rpcMethodHandler) handleFileGet(ctx context.Context, conn *jsonrpc2.Conn, req *jsonrpc2.Request) {
	var params rpc.FileGetParams
	if err := unmarshalParams(req, &params); err != nil {
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, "invalid params")
		return
	}

	result, err := contents.GetContents(h.workDir, params.Path)
	if err != nil {
		if errors.Is(err, contents.ErrNotFound) {
			h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, err.Error())
			return
		}
		if errors.Is(err, contents.ErrInvalidPath) {
			h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInvalidParams, "invalid path")
			return
		}
		h.replyError(ctx, conn, req.ID, jsonrpc2.CodeInternalError, err.Error())
		return
	}

	var response rpc.FileGetResult
	if result.IsDir() {
		response = rpc.FileGetResult{
			Type:    "directory",
			Entries: result.Entries,
		}
	} else {
		response = rpc.FileGetResult{
			Type: "file",
			File: result.File,
		}
	}

	if err := conn.Reply(ctx, req.ID, response); err != nil {
		h.log.Error("failed to send file get response", "error", err)
	}
}
