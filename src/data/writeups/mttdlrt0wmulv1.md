---
title: Kerberoasting an Attack Path to Domain Admin in a Two-Domain Forest
date: 2026-09-01
summary: A lab write-up walking a defender through how a weak service-account password becomes a full-domain compromise — and exactly which controls and detections break the chain. Mapped to MITRE ATT&CK.
tags: [Active Directory, Kerberoasting, MITRE ATT&CK, BloodHound, Red Team]
mitre: [T1558.003, T1087.002, T1110.002, T1003.006]
platform: Home lab
difficulty: Medium
---

> **Sample post.** This is placeholder content showing the write-up layout — an attack chain framed for defenders, with detection and remediation notes. Replace it with your own research.

## TL;DR

In this lab, an ordinary domain user reaches Domain Admin because one service account combines three avoidable weaknesses: a Service Principal Name (SPN), a weak password, and an over-broad ACL. The value of the write-up isn't the attack — it's the four places a defender can cut it.

| Stage | Technique | ATT&CK | Where it breaks |
| --- | --- | --- | --- |
| Discover SPN accounts | Account Discovery | T1087.002 | Alert on unusual LDAP enumeration |
| Request service tickets | Kerberoasting | T1558.003 | Event 4769 anomalies, honey SPN |
| Recover the password | Password Cracking | T1110.002 | Long, random gMSA passwords |
| Replicate secrets | DCSync | T1003.006 | Restrict replication ACLs, alert on 4662 |

## Why this chain works

The attacker never needs an exploit. Each step abuses a legitimate feature of Active Directory that was left in an unsafe default:

1. **Enumeration.** Any authenticated user can query the directory for accounts with an SPN. That's by design — but it means a weak service account is discoverable by everyone in the domain.
2. **Ticket request.** Kerberos hands any user a service ticket encrypted with the service account's password hash. Requesting one is normal behaviour, which is what makes roasting quiet.
3. **Offline cracking.** Because the ticket is taken offline, there's no lockout and no failed-logon trail. The only defence that matters here is password strength.
4. **Privilege escalation.** BloodHound reveals that the cracked account has an ACL edge — `GenericWrite` over a group holding replication rights — turning a service account into a path to every secret in the domain.

## The defender's takeaways

- **Kill the weak-password root cause.** Move service accounts to group Managed Service Accounts (gMSA) so their passwords are long, random, and rotated automatically. This single change neutralises the whole chain.
- **Watch ticket requests.** Baseline Kerberos service-ticket events (4769) and alert on a single account requesting many SPNs, or on requests for a deliberately planted honey SPN that nothing should ever use.
- **Prune ACLs.** Audit who can write to privileged groups. `GenericWrite`, `WriteDacl`, and replication rights are the edges attackers hunt for — review them with BloodHound the same way an attacker would.
- **Constrain DCSync.** Replication rights should belong only to domain controllers. Alert on directory-replication access (4662) from anything else.

## Mapping to MITRE ATT&CK

Framing findings against ATT&CK lets a blue team turn this write-up into concrete detection engineering: each technique above links to its ATT&CK page with recommended data sources and mitigations. A report that reads as an attack chain — not a scanner dump — is one a defender can actually act on.

## Lab setup

Reproduced in an isolated two-domain forest built with Windows Server evaluation editions on VirtualBox. No production systems were involved, and everything here is intended for authorised testing and defensive research only.
