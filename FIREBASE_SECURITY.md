# Firebase security

`firestore.rules` requires Firebase Authentication for production users. Teacher accounts must receive the custom claim `teacher: true` from a trusted Admin SDK environment; never set this claim from the browser. The current local demo login remains a UI fallback and is intentionally not a production authorization mechanism.

Deploy rules with:

```bash
firebase deploy --only firestore:rules
```
