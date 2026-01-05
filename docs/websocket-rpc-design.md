# WebSocket RPC 設計

全ての通信を WebSocket JSON-RPC 2.0 で行う。REST API は使用しない。

## 背景

Pockode は Relay を介して NAT 内のユーザー PC と通信する:

```
モバイルアプリ ──WebSocket──▶ Relay Server ──WebSocket──▶ ユーザー PC (NAT内)
```

NAT 越えには PC 側からの常時接続が必須であり、WebSocket が自然な選択となる。

## ライブラリ

| 層 | ライブラリ |
|----|-----------|
| Go | [sourcegraph/jsonrpc2](https://github.com/sourcegraph/jsonrpc2) |
| TypeScript | [json-rpc-2.0](https://github.com/shogowada/json-rpc-2.0) |

## 参考

- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
