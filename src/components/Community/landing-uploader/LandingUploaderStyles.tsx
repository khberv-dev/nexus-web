"use client"

export function LandingUploaderStyles() {
    return (
        <style>{`
      .landing-up { font-size: 14px; }
      .landing-up-banner {
        padding: 10px 14px;
        border-radius: 10px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
      }
      .landing-up-error {
        padding: 9px 12px;
        border-radius: 8px;
        margin-bottom: 10px;
        font-size: 0.78rem;
      }
      .landing-up-grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 10px;
      }
      .landing-up-row { margin-bottom: 10px; }
      .landing-up-card {
        padding: 14px;
        border-radius: 12px;
        background: rgba(91,79,207,0.03);
        border: 1px solid rgba(91,79,207,0.1);
      }
      .landing-up-card__head { margin-bottom: 10px; }
      .landing-up-card__title-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
      .landing-up-card__title-icon { color: #5b4fcf; font-size: 0.95rem; }
      .landing-up-card__title { font-size: 0.84rem; font-weight: 600; margin: 0; }
      .landing-up-card__sub { font-size: 0.7rem; color: var(--dash-muted, #888); margin: 0; }
      .landing-up-media-row { display: flex; gap: 10px; align-items: flex-end; }
      .landing-up-media-preview {
        width: 92px; height: 136px; border-radius: 10px; overflow: hidden; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      }
      .landing-up-btn { font-size: 0.75rem; }
      .landing-up-small-btn {
        border: 1px solid rgba(91,79,207,0.3);
        background: rgba(91,79,207,0.09);
        color: #5b4fcf;
        border-radius: 7px;
        padding: 4px 7px;
        font-size: 0.68rem;
        line-height: 1.1;
        cursor: pointer;
        white-space: nowrap;
      }
      .landing-up-small-btn--danger {
        color: #d64c67;
        border-color: rgba(214,76,103,0.36);
        background: rgba(214,76,103,0.1);
      }
      .landing-up-row-line {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 10px;
        align-items: start;
      }
      .landing-up-upload-tile {
        width: 92px;
        height: 126px;
        border-radius: 10px;
        border: 2px dashed rgba(91,79,207,0.24);
        background: rgba(91,79,207,0.05);
        color: #5b4fcf;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        cursor: pointer;
        font-size: 0.7rem;
      }
      .landing-up-upload-tile i { font-size: 1.2rem; }
      .landing-up-thumb-strip {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
        gap: 8px;
      }
      .landing-up-carousel { min-height: 126px; }
      .landing-up-carousel__viewport {
        height: 126px;
        padding: 0 18px 0;
        align-items: stretch;
      }
      .landing-up-carousel__item {
        flex: 0 0 92px;
        scroll-snap-align: start;
      }
      .landing-up-thumb {
        width: 92px;
        height: 126px;
        border: 1px solid rgba(91,79,207,0.24);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(91,79,207,0.04);
        padding: 0;
        position: relative;
        cursor: pointer;
      }
      .landing-up-thumb.is-selected { border-color: #5b4fcf; }
      .landing-up-thumb-actions {
        position: absolute;
        right: 4px;
        top: 4px;
      }
      .landing-up-select-btn {
        border: 0;
        background: rgba(12, 14, 22, 0.6);
        border-radius: 999px;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #c9d0ff;
        cursor: pointer;
      }
      .landing-up-tick.is-selected { color: #3ad488; }
      @media (max-width: 960px) {
        .landing-up-grid-2 { grid-template-columns: 1fr; }
        .landing-up-row-line { grid-template-columns: 1fr; }
        .landing-up-upload-tile { width: 100%; height: 70px; }
        .landing-up-carousel__viewport { height: 92px; }
        .landing-up-carousel__item,
        .landing-up-thumb { width: 92px; height: 92px; }
      }
    `}</style>
    )
}
