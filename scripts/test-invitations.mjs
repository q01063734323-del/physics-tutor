import assert from "node:assert/strict";
import { createInvitationToken, invitationExpiry } from "../src/lib/invitations.ts";

const first = createInvitationToken();
const second = createInvitationToken();
assert.equal(first.length, 64);
assert.notEqual(first, second);
assert.ok(Date.parse(invitationExpiry(7)) > Date.now());
console.log("invitation tests passed");
