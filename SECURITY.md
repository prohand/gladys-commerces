# Security policy

## Supported versions

Only the latest release of the E.Leclerc integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-eleclerc](https://github.com/prohand/gladys-eleclerc/security), then
**Report a vulnerability**.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- any log line that helps (remove tokens and addresses first).

You should get a first answer within 7 days. A fix is released as a new version of
the integration, and the advisory is published once users can update.

## Scope

In scope: the code of this repository and the Docker image it publishes.

Out of scope: Gladys Assistant itself (report to
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)),
E.Leclerc services, and the RappelConso open data and API
(data.economie.gouv.fr).

## How the integration limits its exposure

- It holds no secret: no account, no API key, no password.
- It only calls `https://data.economie.gouv.fr` (read-only, public data). The only
  user input sent there is a barcode being checked, kept to its digits.
- It writes one file, `/data/recalls-seen.json` (notice numbers only), in the one
  writable volume; the image runs as a non-root user on a read-only root filesystem.
- Texts from the register are shown through the Gladys widget vocabulary, which
  escapes them: no HTML is ever rendered.

## Good practices for users

- Keep Gladys and the integration up to date.
- A recall notice is authoritative only on
  [rappel.conso.gouv.fr](https://rappel.conso.gouv.fr/): follow its link before acting.
