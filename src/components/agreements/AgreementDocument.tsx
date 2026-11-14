import { AgreementItem } from "@/lib/agreements";
import { DISCLAIMER, buildClauses } from "@/lib/agreementText";

// The agreement as it will read in the PDF: both are built from the same wording.
export const AgreementDocument = ({ agreement }: { agreement: AgreementItem }) => (
  <div className="space-y-6 text-sm leading-relaxed">
    {buildClauses(agreement).map((clause, i) => (
      <section key={clause.heading}>
        <h4 className="font-display font-semibold">{i + 1}. {clause.heading}</h4>
        <div className="mt-1.5 space-y-2 text-muted-foreground">
          {clause.paragraphs.map((p, n) => <p key={n} className="whitespace-pre-line break-words">{p}</p>)}
        </div>
        {clause.table && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  {clause.table.head.map(h => <th key={h} className="py-1.5 pr-4 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {clause.table.rows.map((row, r) => (
                  <tr key={r} className="border-b border-border/60">
                    {row.map((cell, c) => <td key={c} className="py-1.5 pr-4">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
              {clause.table.foot && (
                <tfoot>
                  <tr className="font-semibold">
                    {clause.table.foot.map((cell, c) => <td key={c} className="py-1.5 pr-4">{cell}</td>)}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    ))}
    <p className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">{DISCLAIMER}</p>
  </div>
);
