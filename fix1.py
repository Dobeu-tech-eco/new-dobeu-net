import os

content = ""
with open("components/landing/Proof.tsx", "r") as f:
    content = f.read()

search = """const QUOTES = [
  {
    quote:
      "He shipped our internal agent in a week — what our last vendor couldn&apos;t do in three months. The portal, the docs, the handoff: all of it just worked.",
    author: "Operations Lead",
    org: "Logistics SaaS, NYC",
  },"""

replace = """const QUOTES = [
  {
    quote:
      "He shipped our internal agent in a week — what our last vendor couldn't do in three months. The portal, the docs, the handoff: all of it just worked.",
    author: "Operations Lead",
    org: "Logistics SaaS, NYC",
  },"""

content = content.replace(search, replace)

search2 = """              <p
                className="text-base md:text-lg leading-relaxed text-foreground"
                dangerouslySetInnerHTML={{ __html: `“${q.quote}”` }}
              />"""

replace2 = """              {/* Security: Render via standard React children to prevent XSS instead of dangerouslySetInnerHTML */}
              <p className="text-base md:text-lg leading-relaxed text-foreground">
                &ldquo;{q.quote}&rdquo;
              </p>"""

content = content.replace(search2, replace2)

with open("components/landing/Proof.tsx", "w") as f:
    f.write(content)

print("done")
