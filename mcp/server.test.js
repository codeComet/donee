import { test } from "node:test";
import assert from "node:assert/strict";
import { htmlToText, textToHtml } from "./server.js";

test("html <-> text round trip", () => {
  const html = textToHtml("Hi <b> & @Jane Doe\nline2\n\npara2");
  assert.equal(html, "<p>Hi &lt;b&gt; &amp; @Jane Doe<br>line2</p><p>para2</p>");
  assert.equal(htmlToText(html), "Hi <b> & @Jane Doe\nline2\npara2");
  assert.equal(htmlToText('<p>see</p><img src="https://x/a.png">'), "see\n[image: https://x/a.png]");
});
