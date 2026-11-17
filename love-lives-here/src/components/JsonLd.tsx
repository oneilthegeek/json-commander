/**
 * Structured data. JSON-LD is a non-executing data block, so CSP doesn't
 * apply and no nonce is needed. `<` is escaped so content can never break
 * out of the script element.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
