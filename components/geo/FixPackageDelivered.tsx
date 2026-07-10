'use client';

import {
  copyText,
  isFixPayloadFile,
  parseFixFileMeta,
  type FixPackageResponse,
} from '@/lib/fixDeliveryActions';

interface Props {
  pkg: FixPackageResponse;
  siteUrl: string;
  tier: 'diy' | 'ai';
  onClose: () => void;
  onRedownload: () => void;
}

export function FixPackageDelivered({
  pkg,
  siteUrl,
  tier,
  onClose,
  onRedownload,
}: Props) {
  const prompt =
    pkg.prompt
    ?? pkg.files.find((f) => f.filename === 'PROMPT.txt')?.content
    ?? '';

  const fixFiles = pkg.files.filter((f) => isFixPayloadFile(f.filename));

  return (
    <section className="screen active fixPackageDelivered">
      <div className="fixPackageHeader">
        <div>
          <h2>Package downloaded!</h2>
          <p>
            Your ZIP for <b>{siteUrl}</b> is saved. Inside you&apos;ll find:
          </p>
        </div>
        <button type="button" className="closeScreenBtn" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <ul className="fixPackageFileList">
        <li>
          <b>README.md</b> — step-by-step install instructions for your platform
        </li>
        {fixFiles.map((file) => {
          const meta = parseFixFileMeta(file);
          const points =
            meta.points !== null ? `(+${meta.points} points)` : '';
          return (
            <li key={file.filename}>
              <b>{file.filename}</b> — fixes {meta.check} {points}
            </li>
          );
        })}
      </ul>

      <p className="fixPackageVerify">
        Re-run the free scan after installing to verify your new score.
      </p>

      {tier === 'ai' && (
        <div className="fixPackageAiBlock">
          <p>
            Open <b>PROMPT.txt</b>, copy everything, paste into ChatGPT or Claude.
            It walks you through each fix — about a minute each.
          </p>
          {prompt && (
            <button
              type="button"
              className="btn primary"
              onClick={() => void copyText(prompt)}
            >
              COPY PROMPT
            </button>
          )}
        </div>
      )}

      <div className="fixPackageActions">
        <button type="button" className="btn" onClick={onRedownload}>
          DOWNLOAD ZIP AGAIN
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>
          BACK TO MASTER PLAN
        </button>
      </div>
    </section>
  );
}
