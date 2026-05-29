export default function SocialBar({ social }) {
  const links = social || [];
  if (!links.length) return null;

  return (
    <nav className="social-bar pointer-events-auto">
      {links.map((s) => (
        <a
          key={s.id}
          className="social-btn"
          href={s.url}
          target="_blank"
          rel="noreferrer"
          title={s.platform}
          aria-label={s.platform}
        >
          {s.icon ? (
            <img src={s.icon} alt={s.platform} />
          ) : (
            <span className="text-[10px] font-[Orbitron]">{(s.platform || '?').slice(0, 2)}</span>
          )}
        </a>
      ))}
    </nav>
  );
}
