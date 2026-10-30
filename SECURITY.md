# Security policy

## Supported versions

Only the latest release of the integration receives security fixes.
Update the integration from the Gladys store before reporting an issue.

| Version      | Supported |
| ------------ | --------- |
| 1.x (latest) | Yes       |
| older        | No        |

## Reporting a vulnerability

Please do **not** open a public issue for a security problem.

Report it privately through GitHub: open the **Security** tab of
[prohand/gladys-horaires-commerces](https://github.com/prohand/gladys-horaires-commerces/security), then
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
OpenStreetMap and overpass.ch.

## How the integration limits its exposure

- Its only secret is the user's own overpass.ch key, a `secret` field of the Gladys
  configuration. It is sent only to `api.overpass.ch`, inside the URL as that service
  asks, and never logged (the logs name the host only). No key: no network call.
- The only network call is one OpenStreetMap lookup a day: the words looked for, the
  kinds of shops and an area around each house. User words reach the query only as
  letters and digits. It never asks for a retailer password.
- The image runs as a non-root user on a read-only root filesystem; it writes only
  the hours found, in `/data/hours.json`.

## Good practices for users

- Keep Gladys and the integration up to date.
- Keep your overpass.ch key to yourself: do not paste it in a forum, an issue or a
  screenshot. If it leaks, delete it on overpass.ch and create another.
