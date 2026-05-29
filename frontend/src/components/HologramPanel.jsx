import { useMemo } from 'react';

export default function HologramPanel({ content }) {
  // about is HTML rich text (may contain links). For backward compatibility, if
  // a plain-text value comes in (no tags), convert blank-line paragraphs to <p>.
  const aboutHtml = useMemo(() => {
    const a = content?.about || '';
    if (/<[a-z][\s\S]*>/i.test(a)) return a;
    return a.split(/\n\s*\n/).map((p) => `<p>${p.trim()}</p>`).join('');
  }, [content?.about]);

  return (
    <aside className="holo-wrap pointer-events-auto">
      <div className="holo panel-card">
        <span className="bracket tl" />
        <span className="bracket tr" />
        <span className="bracket bl" />
        <span className="bracket br" />
        <div className="holo-scan" />

        <div className="panel-inner holo-body">
          <div className="tag mb-1">// personnel file</div>
          {content?.subtitle && (
            <h2 className="panel-subtitle holo-rise">{content.subtitle}</h2>
          )}
          <div className="holo-prose holo-rise" dangerouslySetInnerHTML={{ __html: aboutHtml }} />
        </div>
      </div>
    </aside>
  );
}
