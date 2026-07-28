export const SPECIALISTS_STYLES = `
  /* ── split panel: fill adm-content--np ── */
  .sp-wrap {
    display: flex;
    height: 100%;
    overflow: hidden;
  }

  /* ── Left list ── */
  .sp-list {
    width: 260px;
    flex-shrink: 0;
    background: var(--adm-outer);
    border-right: 1px solid var(--adm-sidebar-border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    scrollbar-width: thin;
    scrollbar-color: rgba(0,0,0,0.12) transparent;
  }
  .sp-list::-webkit-scrollbar { width: 5px; }
  .sp-list::-webkit-scrollbar-track { background: transparent; }
  .sp-list::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.12);
    border-radius: 10px;
  }
  .sp-list::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.22); }

  .sp-list-hd {
    padding: 10px 16px;
    border-bottom: 1px solid var(--adm-sidebar-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    background: var(--adm-sidebar);
  }
  .sp-search {
    position: relative;
    padding: 8px 12px;
    flex-shrink: 0;
  }
  .sp-search-icon {
    position: absolute;
    left: 20px; top: 50%;
    transform: translateY(-50%);
    color: var(--adm-muted);
    font-size: 0.9rem;
    pointer-events: none;
  }
  .sp-search-input {
    width: 100%;
    height: 32px;
    padding: 0 8px 0 28px;
    border: 1px solid var(--adm-sidebar-border);
    border-radius: 6px;
    background: transparent;
    color: var(--adm-text);
    font-size: 0.8rem;
    outline: none;
    font-family: inherit;
  }
  .sp-search-input:focus {
    border-color: var(--adm-active-color);
  }
  .sp-search-input::placeholder {
    color: var(--adm-muted);
  }

  .sp-filters {
    display: flex; flex-wrap: wrap; gap: 4px;
    padding: 0 10px 10px; flex-shrink: 0;
  }
  .sp-filter-btn {
    padding: 3px 8px; border-radius: 6px;
    border: 1px solid var(--adm-sidebar-border);
    background: transparent; color: var(--adm-muted);
    font-size: 0.68rem; cursor: pointer;
    font-family: inherit; transition: all 0.12s;
    white-space: nowrap;
  }
  .sp-filter-btn:hover { border-color: var(--adm-active-color); color: var(--adm-active-color); }
  .sp-filter-btn--on {
    background: var(--adm-active-bg); color: var(--adm-active-color);
    border-color: var(--adm-active-color);
  }

  .sp-empty {
    padding: 24px 16px;
    font-size: 0.82rem;
    color: var(--adm-muted);
    text-align: center;
  }

  /* ── User cards (like template) ── */
  .sp-user-card {
    margin: 0 10px 8px;
    padding: 12px 14px;
    background: var(--adm-sidebar);
    border-radius: 8px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    transition: box-shadow 0.2s, transform 0.15s, border-color 0.2s;
    border: 2px solid transparent;
    text-align: left;
  }
  .sp-user-card:first-child { margin-top: 4px; }
  .sp-user-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    transform: translateX(2px);
  }
  .sp-user-card--on {
    border-color: var(--adm-active-color);
    box-shadow: 0 4px 16px rgba(99,102,241,0.2);
    transform: translateX(2px);
  }
  .sp-user-card__top {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 10px; margin-bottom: 10px;
    border-bottom: 1px solid var(--adm-sidebar-border);
  }
  .sp-user-card__av {
    width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
  }
  .sp-user-card__name {
    font-weight: 600; font-size: 0.82rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
    color: var(--adm-name-color, #4b5563);
  }
  .sp-user-card__av-img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
  }
  .sp-user-card__bottom {
    display: flex; align-items: center; justify-content: space-between;
  }
  .sp-user-card__extra {
    font-size: 0.72rem; color: var(--adm-muted);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    max-width: 80px; text-align: right;
  }
  .sp-user-card__edo {
    margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--adm-sidebar-border);
    font-size: 0.65rem; color: var(--adm-muted); line-height: 1.25;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    display: flex; align-items: center; gap: 4px;
    text-align: left;
  }
  .sp-user-card__edo .bx { flex-shrink: 0; font-size: 0.75rem; opacity: 0.85; }

  /* ── Right detail ── */
  .sp-detail {
    flex: 1; overflow-y: auto;
    min-width: 0;
    display: flex; flex-direction: column;
  }
  .sp-detail-empty {
    text-align: center; color: var(--adm-muted); padding: 60px 0; flex: 1;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .sp-detail-empty i { font-size: 48px; opacity: 0.3; display: block; }
  .sp-detail-empty p { margin-top: 8px; }

  .sp-detail-sticky {
    position: sticky; top: 0; z-index: 5;
    background: var(--adm-content-bg);
    border-bottom: 1px solid var(--adm-sidebar-border);
    flex-shrink: 0;
  }
  .sp-detail-tabs { display: flex; flex-wrap: wrap; gap: 2px 4px; padding: 0 28px 6px; align-items: center; }
  .sp-detail-tab {
    padding: 10px 16px; border: none; background: none;
    cursor: pointer; font-size: 0.82rem; font-weight: 500;
    color: var(--adm-muted);
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    font-family: inherit;
  }
  .sp-detail-tab:hover { color: var(--adm-text); }
  .sp-detail-tab--active { color: var(--adm-active-color); border-bottom-color: var(--adm-active-color); }
  @media (prefers-color-scheme: dark) {
    .sp-detail-tab--active { color: #fff; border-bottom-color: #fff; }
  }
  .sp-detail-body { flex: 1; overflow-y: auto; padding: 24px 28px; }

  .sp-profile-header { display: flex; align-items: flex-start; gap: 16px; padding: 20px 28px 16px; }
  .sp-av-xl {
    width: 60px; height: 60px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.5rem; font-weight: 700; flex-shrink: 0;
    background: linear-gradient(135deg, var(--adm-active-color), #a78bfa);
    color: #fff;
    border: 2px solid var(--adm-active-color);
    overflow: hidden;
  }
  .sp-profile-info { flex: 1; min-width: 0; }
  .sp-profile-name { font-weight: 600; font-size: 1.2rem; margin: 0 0 6px; color: var(--adm-name-color, #4b5563); }
  .sp-profile-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sp-profile-email { color: var(--adm-muted); font-size: 0.8rem; }
  .sp-profile-location { color: var(--adm-muted); font-size: 0.78rem; margin-top: 6px; }
  .sp-profile-edo {
    color: var(--adm-muted); font-size: 0.78rem; margin-top: 6px; line-height: 1.35;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sp-profile-edo .bx { margin-right: 4px; vertical-align: -1px; }
  .sp-profile-location i { margin-right: 2px; }
  .sp-profile-actions { display: flex; gap: 8px; flex-shrink: 0; }
  .sp-profile-right {
    margin-left: auto; display: flex; flex-direction: column;
    align-items: flex-end; gap: 8px; flex-shrink: 0;
  }
  .sp-profile-stat { text-align: right; }
  .sp-profile-stat__label { font-size: 0.68rem; color: var(--adm-muted); }
  .sp-profile-stat__value { font-size: 1.1rem; font-weight: 600; }

  .sp-orders-placeholder { text-align: center; color: var(--adm-muted); padding: 48px 0; }
  .sp-orders-placeholder i { font-size: 40px; opacity: 0.3; display: block; margin-bottom: 8px; }
  .sp-orders-placeholder p { margin: 0 0 16px; }
  .sp-order-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--adm-sidebar-border);
  }
  .sp-order-row:last-child { border-bottom: none; }

  .sp-onboarding-bar {
    background: var(--adm-sidebar);
    border: 1px solid var(--adm-sidebar-border);
    border-radius: 10px; padding: 16px 20px;
    margin-bottom: 20px;
  }
  .sp-onboarding-bar__track {
    height: 4px; background: var(--adm-sidebar-border);
    border-radius: 10px; overflow: hidden; margin-bottom: 14px;
  }
  .sp-onboarding-bar__fill {
    height: 100%; border-radius: 10px;
    background: linear-gradient(to right, #22c55e, #4ade80);
    transition: width 0.3s;
  }
  .sp-onboarding-steps { display: flex; justify-content: space-between; }
  .sp-onboarding-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; background: none; border: none; }
  .sp-onboarding-step__dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 700;
    background: var(--adm-hover-bg); color: var(--adm-muted);
    transition: background 0.2s, color 0.2s;
  }
  .sp-onboarding-step--done .sp-onboarding-step__dot { background: rgba(34,197,94,0.15); color: #22c55e; }
  .sp-onboarding-step--done .sp-onboarding-step__dot i { font-size: 1rem; }
  .sp-onboarding-step__label { font-size: 0.68rem; color: var(--adm-muted); text-align: center; }
  .sp-onboarding-step--done .sp-onboarding-step__label { color: var(--adm-text); }
  .sp-onboarding-step--active .sp-onboarding-step__dot {
    background: rgba(14, 165, 233, 0.18);
    color: #0ea5e9;
    border: 2px solid rgba(14, 165, 233, 0.7);
    box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.12);
  }
  .sp-onboarding-step--active .sp-onboarding-step__label { color: #0ea5e9; font-weight: 600; }
  .sp-onboarding-step--clickable { cursor: pointer; }
  .sp-onboarding-step--clickable:hover .sp-onboarding-step__dot { box-shadow: 0 0 0 3px var(--adm-active-bg); }
  .sp-onboarding-step--clickable:hover .sp-onboarding-step__label { color: var(--adm-active-color); }

  .sp-quiz-micro-wrap {
    background: var(--adm-sidebar);
    border: 1px solid var(--adm-sidebar-border);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 18px;
  }
  .sp-quiz-micro-label {
    font-size: 0.78rem;
    color: var(--adm-muted);
    margin-bottom: 10px;
    line-height: 1.45;
  }
  .sp-quiz-micro-ticks {
    display: flex;
    gap: 3px;
    flex-wrap: nowrap;
    width: 100%;
  }
  .sp-quiz-micro-tick {
    flex: 1 1 0;
    min-width: 2px;
    height: 6px;
    border-radius: 2px;
    background: var(--adm-sidebar-border);
    transition: background 0.2s, transform 0.15s;
  }
  .sp-quiz-micro-tick--answered {
    cursor: help;
  }
  .sp-quiz-micro-tick--answered:hover {
    transform: scaleY(1.35);
  }
  .sp-quiz-micro-tick--correct {
    background: linear-gradient(90deg, #22c55e, #4ade80);
  }
  .sp-quiz-micro-tick--wrong {
    background: linear-gradient(90deg, #dc2626, #f87171);
  }

  .sp-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .sp-info-item { display: flex; align-items: flex-start; gap: 10px; }
  .sp-info-icon {
    width: 34px; height: 34px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1rem; flex-shrink: 0;
  }
  .sp-info-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--adm-muted); }
  .sp-info-value { font-weight: 500; font-size: 0.85rem; }
  .sp-info-value--empty { color: var(--adm-muted); font-weight: 400; font-style: italic; opacity: 0.6; }
  .sp-info-link {
    color: var(--adm-active-color); font-size: 0.82rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    display: block; max-width: 240px; text-decoration: none;
  }
  .sp-info-link:hover { text-decoration: underline; }
  .sp-about { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--adm-sidebar-border); }
  .sp-about-text { margin: 4px 0 0; font-size: 0.82rem; color: var(--adm-muted); white-space: pre-wrap; line-height: 1.5; }

  .sp-rating-section { margin-bottom: 16px; }
  .sp-stars { display: flex; align-items: center; gap: 2px; }
  .sp-star {
    background: none; border: none; cursor: pointer; padding: 2px;
    font-size: 1.5rem; line-height: 1;
    color: var(--adm-sidebar-border); transition: color 0.15s;
  }
  .sp-star--on { color: #f59e0b; }
  .sp-star:hover { color: #fbbf24; }
  .sp-star-value { color: var(--adm-muted); margin-left: 6px; font-weight: 600; font-size: 0.85rem; }

  .sp-landing-toggle { display: flex; align-items: center; gap: 10px; padding-top: 14px; border-top: 1px solid var(--adm-sidebar-border); }
  .sp-toggle-input { cursor: pointer; accent-color: var(--adm-active-color); width: 16px; height: 16px; }
  .sp-toggle-label { cursor: pointer; }
  .sp-toggle-text { font-weight: 500; font-size: 0.85rem; }
  .sp-toggle-sub { color: var(--adm-muted); margin-left: 4px; font-size: 0.75rem; }

  .sp-meta-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--adm-sidebar-border); font-size: 0.82rem; }
  .sp-meta-row:last-child { border-bottom: none; }
  .sp-meta-label { color: var(--adm-muted); min-width: 80px; }
  .sp-meta-value { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .sp-comment-row { padding: 6px 0; font-size: 0.82rem; border-bottom: 1px solid var(--adm-sidebar-border); }
  .sp-comment-row:last-child { border-bottom: none; }
  .sp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
  @media (max-width: 720px) {
    .sp-grid { grid-template-columns: 1fr; }
    .sp-list { width: 100%; height: 220px; flex-shrink: 0; }
    .sp-wrap { flex-direction: column; }
  }

  .sp-card { background: var(--adm-sidebar); border: 1px solid var(--adm-sidebar-border); border-radius: 8px; margin-bottom: 12px; }
  .sp-card-hd { padding: 7px 14px; border-bottom: 1px solid var(--adm-sidebar-border); }
  .sp-card-bd { padding: 12px 14px; }

  .sp-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--adm-muted); }
  .sp-badge {
    display: inline-flex; align-items: center;
    background: var(--adm-active-bg); color: var(--adm-active-color);
    padding: 2px 8px; border-radius: 10px; font-size: 0.72rem; font-weight: 600;
  }

  .sp-btn {
    display: inline-flex; align-items: center;
    padding: 5px 14px; border-radius: 6px; border: 1px solid transparent;
    cursor: pointer; font-size: 0.8rem; font-weight: 500; transition: opacity 0.15s; line-height: 1.4;
  }
  .sp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .sp-btn-primary { background: var(--adm-active-color); color: #fff; border-color: var(--adm-active-color); }
  .sp-btn-danger { background: transparent; color: #ef4444; border-color: #ef4444; }
  .sp-btn-ghost { background: transparent; color: var(--adm-muted); border-color: var(--adm-sidebar-border); }
  .sp-btn-ghost:hover:not(:disabled) { background: var(--adm-hover-bg); }

  .sp-warn {
    background: rgba(234,179,8,0.10);
    border: 1px solid rgba(234,179,8,0.30);
    color: #ca8a04;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.82rem;
    margin-bottom: 12px;
  }

  .sp-modal-body { padding: 4px 0; }
  .sp-modal-title { margin: 0 0 16px; font-size: 1rem; font-weight: 600; }
  .sp-modal-empty { text-align: center; padding: 24px; color: var(--adm-muted); }
  .sp-modal-empty__title { font-weight: 600; margin: 8px 0 4px; color: var(--adm-text); }
  .sp-modal-empty__sub { font-size: 0.82rem; margin: 0; }
  .sp-modal-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--adm-sidebar-border); }
  .sp-modal-score { font-size: 0.82rem; color: var(--adm-muted); }
  .sp-test-list { display: flex; flex-direction: column; gap: 16px; max-height: 60vh; overflow-y: auto; }
  .sp-test-q__meta { font-size: 0.68rem; color: var(--adm-muted); margin: 0 0 8px; line-height: 1.35; }
  .sp-test-q__text { margin: 0 0 12px; font-size: 0.88rem; line-height: 1.45; }
  .sp-test-q--ok { padding: 10px; border-radius: 8px; background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); }
  .sp-test-q--fail { padding: 10px; border-radius: 8px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.22); }
  .sp-test-opts { display: flex; flex-direction: column; gap: 6px; }
  .sp-test-opt { font-size: 0.8rem; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--adm-sidebar-border); display: flex; align-items: flex-start; gap: 8px; line-height: 1.4; }
  .sp-test-opt--correct { border-color: rgba(34,197,94,0.45); background: rgba(34,197,94,0.06); }
  .sp-test-opt--correct-pick { border-color: #22c55e; background: rgba(34,197,94,0.12); }
  .sp-test-opt--wrong-pick { border-color: rgba(239,68,68,0.5); background: rgba(239,68,68,0.08); }
  .sp-test-opt-letter { flex-shrink: 0; width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--adm-sidebar-border); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700; }

  .sp-onb-summary { margin-bottom: 12px; }
  .sp-onb-summary__track {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--adm-sidebar-border);
  }
  .sp-onb-summary__fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #22c55e, #4ade80);
    transition: width 0.25s ease;
  }
  .sp-onb-summary__meta {
    margin-top: 6px;
    font-size: 0.74rem;
    color: var(--adm-muted);
  }
  .sp-onb-timeline {
    display: grid;
    gap: 8px;
  }
  .sp-onb-item {
    display: flex;
    gap: 10px;
    border: 1px solid var(--adm-sidebar-border);
    border-radius: 8px;
    padding: 9px 10px;
    background: var(--adm-outer);
  }
  .sp-onb-item__dot {
    width: 22px;
    height: 22px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--adm-sidebar-border);
    color: var(--adm-muted);
    font-size: 0.7rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }
  .sp-onb-item__dot--passed {
    color: #22c55e;
    border-color: rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.08);
  }
  .sp-onb-item__content { min-width: 0; flex: 1; }
  .sp-onb-item__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .sp-onb-item__title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--adm-text);
  }
  .sp-onb-item__status {
    font-size: 0.66rem;
    font-weight: 700;
    border-radius: 999px;
    padding: 2px 8px;
    border: 1px solid transparent;
    white-space: nowrap;
  }
  .sp-onb-item__status--passed { color: #22c55e; border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.1); }
  .sp-onb-item__status--progress { color: #0ea5e9; border-color: rgba(14,165,233,0.35); background: rgba(14,165,233,0.1); }
  .sp-onb-item__status--failed { color: #ef4444; border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.08); }
  .sp-onb-item__status--pending { color: var(--adm-muted); border-color: var(--adm-sidebar-border); background: transparent; }
  .sp-onb-item__sub {
    margin-top: 3px;
    font-size: 0.7rem;
    color: var(--adm-muted);
  }
  .sp-onb-item__comment {
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--adm-text);
    opacity: 0.78;
    line-height: 1.4;
    word-break: break-word;
  }
`
