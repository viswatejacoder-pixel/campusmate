// The CampusMate mascot (Liquid Glass design): a glossy blue blob with two eyes and two sparkles. Decorative (aria-hidden); the greeting is
// real text. It floats, blinks and twinkles only when the person has not asked for reduced motion (liquid.css).
const SPARKLE = 'M12 0l2.3 9.7L24 12l-9.7 2.3L12 24l-2.3-9.7L0 12l9.7-2.3z';

export default function Mascot({ caption = 'Hi, time for work!' }) {
  return (
    <div className="mascot">
      <div className="mascot-stage" aria-hidden="true">
        <span className="mascot-shadow" />
        <span className="mascot-body">
          <span className="mascot-eye" />
          <span className="mascot-eye" />
        </span>
        <svg className="mascot-sparkle mascot-sparkle--big" viewBox="0 0 24 24" focusable="false"><path d={SPARKLE} /></svg>
        <svg className="mascot-sparkle mascot-sparkle--small" viewBox="0 0 24 24" focusable="false"><path d={SPARKLE} /></svg>
      </div>
      <p className="mascot-caption">{caption}</p>
    </div>
  );
}
