import { htmlToLine, htmlToParagraphs } from "./plain-text";

describe("CV assistant plain-text conversion", () => {

  it("splits paragraphs on double breaks, including the nonstandard </br>", () => {
    expect(htmlToParagraphs("Intro.</br></br><b>Task:</b> Build.</br></br><b>Action:</b></br>• One.</br>• Two."))
      .toEqual(["Intro.", "Task: Build.", "Action:\n• One.\n• Two."]);
    expect(htmlToParagraphs("A<br><br>B<br/>C")).toEqual(["A", "B\nC"]);
  });

  it("treats paragraph and list elements as boundaries", () => {
    expect(htmlToParagraphs("<p>First</p><p>Second</p><ul><li>a</li><li>b</li></ul>"))
      .toEqual(["First", "Second", "• a\n• b"]);
  });

  it("decodes entities after removing tags, so encoded markup stays text", () => {
    expect(htmlToLine("Tom &amp; Jerry &lt;script&gt;alert(1)&lt;/script&gt; &#233;&#x20AC;&nbsp;!")).toBe("Tom & Jerry <script>alert(1)</script> é€ !");
    expect(htmlToLine("bad &#xD800; &#0; &unknown; end")).toBe("bad &unknown; end");
  });

  it("drops script, style and other inert elements with their content", () => {
    expect(htmlToLine("a<script>alert('x')</script>b<style>p{}</style>c<iframe src='https://x'></iframe>d")).toBe("abcd");
    expect(htmlToLine("visible<script>never closed")).toBe("visible");
    expect(htmlToLine("x<!-- hidden -->y")).toBe("xy");
  });

  it("keeps the text of links and inline formatting but never the markup", () => {
    expect(htmlToLine("I'm a <i>Full-Stack</i> at <a href=\"javascript:alert(1)\" onclick=\"x()\">Swisscom</a>.")).toBe("I'm a Full-Stack at Swisscom.");
    expect(htmlToLine("<img src=x onerror=alert(1)>text")).toBe("text");
  });

  it("collapses whitespace and leaves plain text untouched", () => {
    expect(htmlToLine("  Java   (Android)\n ")).toBe("Java (Android)");
    expect(htmlToLine("O(n²) & C++ / C# / .NET")).toBe("O(n²) & C++ / C# / .NET");
    expect(htmlToParagraphs("")).toEqual([]);
  });

  it("does not touch the DOM", () => {
    const before = document.body.innerHTML;
    htmlToParagraphs("<img src='https://example.invalid/x.png'><script>window.__ran = true</script>");
    expect(document.body.innerHTML).toBe(before);
    expect((window as any).__ran).toBeUndefined();
  });
});
