#!/usr/bin/python
from __future__ import annotations

import os
import subprocess

from ansible.module_utils.basic import AnsibleModule


def run_cli(module, args):
    env = os.environ.copy()
    if module.params.get("creds_path"):
        env["HE_NET_CREDS"] = module.params["creds_path"]
    completed = subprocess.run(
        [module.params["cli_path"]] + args,
        capture_output=True,
        env=env,
        text=True,
        timeout=module.params["timeout"],
        check=False,
    )
    return {
        "cmd": [module.params["cli_path"]] + args,
        "rc": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def main():
    module = AnsibleModule(
        argument_spec={
            "zone": {"type": "str"},
            "state": {"type": "str", "choices": ["list", "inspect", "inspect_convert"], "default": "list"},
            "cli_path": {"type": "str", "default": "he-net"},
            "creds_path": {"type": "str", "no_log": True},
            "timeout": {"type": "int", "default": 120},
        },
        supports_check_mode=True,
    )

    state = module.params["state"]
    if state == "list":
        result = run_cli(module, ["he", "list-zones", "--json"])
    elif state == "inspect":
        if not module.params.get("zone"):
            module.fail_json(msg="zone is required for inspect")
        result = run_cli(module, ["he", "inspect-zone", "--zone", module.params["zone"], "--json"])
    else:
        if not module.params.get("zone"):
            module.fail_json(msg="zone is required for inspect_convert")
        result = run_cli(module, ["he", "inspect-convert", "--zone", module.params["zone"]])

    if result["rc"] != 0:
        module.fail_json(msg="he-net zone command failed", result=result)
    module.exit_json(changed=False, result=result)


if __name__ == "__main__":
    main()
