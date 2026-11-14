import { LockKeyhole } from "lucide-react";
import { PITCH_SECTIONS, PitchDetails, formatWhen, hasAnyDetails } from "@/lib/pitchAccess";

export interface ReaderInfo {
  name: string | null;
  email: string | null;
  ndaAcceptedAt: string | null;
}

// A faint diagonal pattern of the reader's name and email over the page. It discourages sharing screenshots
// and shows where a leak came from; it cannot physically stop someone from copying what they can see.
const watermarkImage = (text: string) => {
  const svg =
    // Wide enough that the whole line fits inside one repeat even when it is long.
    `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='260'>` +
    `<text x='70' y='140' transform='rotate(-22 320 130)' font-family='sans-serif' font-size='14' fill='#808080' fill-opacity='0.16'>${text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;")}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

export const ProtectedPitch = ({ details, reader }: { details: PitchDetails; reader?: ReaderInfo }) => {
  const who = [reader?.name, reader?.email && `<${reader.email}>`].filter(Boolean).join(" ");
  const mark = reader ? `Confidential - ${who}` : "";

  return (
    <div>
      {reader && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm">
          <LockKeyhole className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p>
            <span className="font-medium">Confidential.</span> Shared with {who || "you"}
            {reader.ndaAcceptedAt && <> under the confidentiality terms you accepted on {formatWhen(reader.ndaAcceptedAt)}</>}. Please do not copy or share it.
          </p>
        </div>
      )}

      <div className="relative">
        {!hasAnyDetails(details) ? (
          // A pitch can be documents only; four "Not provided." lines would just be noise.
          <p className="text-sm italic text-muted-foreground/80">The founder has not written any text sections. Their supporting documents, if any, are listed below.</p>
        ) : (
          <div className="space-y-6">
            {PITCH_SECTIONS.map(section => (
              <section key={section.key}>
                <h4 className="font-display font-semibold">{section.label}</h4>
                {details[section.key].trim()
                  ? <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{details[section.key]}</p>
                  : <p className="mt-1.5 text-sm italic text-muted-foreground/70">Not provided.</p>}
              </section>
            ))}
          </div>
        )}
        {reader && (
          <div
            aria-hidden="true"
            data-testid="watermark"
            data-watermark={mark}
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: watermarkImage(mark), backgroundRepeat: "repeat" }}
          />
        )}
      </div>
    </div>
  );
};
