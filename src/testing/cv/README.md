# Test CV fixture

A frozen copy of the original CV data (`about.json`, `experiences.json`, `posts.json`). The unit
specs, the functions tests and the browser suite read these files instead of
`src/assets/data/`, so editing the site's own CV doesn't break any test.

Don't update these files when the CV changes. Change them only when a test needs a new kind of
record, and update the assertions that depend on them in the same commit.
