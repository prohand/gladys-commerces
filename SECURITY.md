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
[GladysAssistant/Gladys](https://github.com/GladysAssistant/Gladys/security)) and
the services of the retailers whose cards are stored.

## How the integration limits its exposure

- It holds no secret and makes no network call: no account, no API key, no password.
  It never asks for a retailer password.
- Loyalty card numbers stay in the Gladys configuration and in the integration's
  `/data/cards.json` (numbers and balances only); the image runs as a non-root user on
  a read-only root filesystem.
- The barcode image is generated in the container from the configured numbers only;
  an image key that is not a configured card is refused.

## Good practices for users

- Keep Gladys and the integration up to date.
- A loyalty card barcode shown on a dashboard can be scanned by anyone who sees it:
  do not put that widget on a dashboard displayed in a public place.
