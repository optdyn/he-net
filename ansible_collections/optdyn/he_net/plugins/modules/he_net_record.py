#!/usr/bin/python
from __future__ import annotations

import json
import os
import subprocess
import tempfile

from ansible.module_utils.basic import AnsibleModule


def run_cli(module, args):
    cli = module.params["cli_path"]
    env = os.environ.copy()
    if module.params.get("creds_path"):
        env["HE_NET_CREDS"] = module.params["creds_path"]
    completed = subprocess.run(
        [cli] + args,
        capture_output=True,
        env=env,
        text=True,
        timeout=module.params["timeout"],
        check=False,
    )
    return {
        "cmd": [cli] + args,
        "rc": completed.returncode,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }


def main():
    module = AnsibleModule(
        argument_spec={
            "zone": {"type": "str", "required": True},
            "desired": {"type": "list", "elements": "dict", "required": True},
            "execute": {"type": "bool", "default": False},
            "confirm_zone": {"type": "str", "default": ""},
            "confirm_apply": {"type": "str", "default": ""},
            "cli_path": {"type": "str", "default": "he-net"},
            "creds_path": {"type": "str", "no_log": True},
            "timeout": {"type": "int", "default": 120},
        },
        supports_check_mode=True,
    )

    zone = module.params["zone"]
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
        json.dump({"records": module.params["desired"]}, handle)
        desired_path = handle.name

    try:
        if module.params["execute"] and not module.check_mode:
            if module.params["confirm_zone"] != zone or module.params["confirm_apply"] != "APPLY_RECORDS":
                module.fail_json(msg=f"Mutation requires confirm_zone={zone} and confirm_apply=APPLY_RECORDS")
            result = run_cli(
                module,
                [
                    "he",
                    "apply-records",
                    "--zone",
                    zone,
                    "--desired",
                    desired_path,
                    "--execute",
                    "--confirm-zone",
                    zone,
                    "--confirm-apply",
                    "APPLY_RECORDS",
                ],
            )
            module.exit_json(changed=True, result=result)

        result = run_cli(module, ["he", "plan-records", "--zone", zone, "--desired", desired_path, "--json"])
        changed = result["rc"] == 2
        if result["rc"] not in (0, 2):
            module.fail_json(msg="he-net plan-records failed", result=result)
        module.exit_json(changed=changed, result=result)
    finally:
        try:
            os.unlink(desired_path)
        except OSError:
            pass


if __name__ == "__main__":
    main()
