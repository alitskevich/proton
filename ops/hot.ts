// `proton hot <dir> <port>`: the hot reload server, which watches `dir` and streams its changes
// on 127.0.0.1:<port>. It lives with the rest of the hot reload in `hot/`; this file only gives
// it a script name. See hot/README.md.

import "../hot/server/main";
