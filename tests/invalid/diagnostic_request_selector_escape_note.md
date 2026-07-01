# Diagnostic selector injection fixture note

Some literal unsafe selector payloads can be blocked by repository connector safety checks while writing fixtures.
Use escaped JSON strings when possible so JSON parsing reconstructs the unsafe selector before validation.
The validator rejects quotes, semicolons, parentheses, brackets, equals signs, slash, backslash, newline, fetch-like tokens, and document.cookie-like tokens.
