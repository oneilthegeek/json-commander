import Image from "next/image";
import { IMG_Q } from "@/lib/images";
import Link from "next/link";
import { AddToBag } from "./AddToBag";
import { TagArt } from "./TagArt";
import type { ClientProduct } from "@/lib/present";

export function ProductCard({ p, whatsapp, flower }: { p: ClientProduct; whatsapp: string; flower?: boolean }) {
  return (
    <article className={`prod${flower ? " flower" : ""}`} aria-labelledby={`h-${p.slug}`}>
      <Link className="pic" href={`/shop/${p.slug}`} tabIndex={-1} aria-hidden="true">
        {p.image ? (
          <Image quality={IMG_Q} src={p.image.src} alt="" fill sizes="(min-width: 900px) 30vw, (min-width: 560px) 45vw, 90vw" />
        ) : p.kind === "llh_tag" ? <TagArt label="" /> : null}
        {p.badge && <span className={`tag${p.kind === "gold_card" ? " gold" : ""}`}>{p.badge}</span>}
      </Link>
      <h3 id={`h-${p.slug}`}><Link href={`/shop/${p.slug}`}>{p.name}</Link></h3>
      <p>{p.tagline}</p>
      <AddToBag product={p} whatsapp={whatsapp} compact />
    </article>
  );
}
