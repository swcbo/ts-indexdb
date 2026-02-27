# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| 0.0.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in `ts-indexdb`, please report it by opening a GitHub issue at:

https://github.com/q1104133609/Ts-IndexDb/issues

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if any)

We will respond within 72 hours and provide a timeline for the fix.

## Security Considerations

`ts-indexdb` is a browser-side IndexedDB wrapper. Data stored via this library is subject to the same security constraints as the browser's IndexedDB:

- Data is stored in the user's browser storage and is **not encrypted by default**.
- Do not store sensitive credentials or PII without additional application-level encryption.
- IndexedDB is sandboxed per origin; cross-origin access is not possible.
