# Test Domains

Live test domains are local operator configuration, not repository defaults.

Create `./test-domains.txt` or symlink it to a private file. The file format is
one domain name per line. Blank lines and lines beginning with `#` are ignored.

Example:

```text
# Domains approved for this operator's live tests.
example.com
example.net
```

Example symlink:

```bash
ln -s /path/to/private/test-domains.txt ./test-domains.txt
```

List configured domains:

```bash
node bin/he-net.js test-domains list
```

> [!IMPORTANT]
> A domain appearing in `test-domains.txt` is not approval for mutation by
> itself. Live mutation still requires an explicit concrete operation request
> and the normal confirmation gates.
