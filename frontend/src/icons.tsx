// Small line icons (24×24, drawn with the text color).

const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="tq-icon">
    <path d={d} />
  </svg>
);

export const ChatIcon = () => <Svg d="M4 5h16v11H9l-5 4z" />;
export const CloseIcon = () => <Svg d="M6 6l12 12M18 6L6 18" />;
export const SendIcon = () => <Svg d="M5 12h14M13 6l6 6-6 6" />;
export const NewIcon = () => <Svg d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />;
export const SearchIcon = () => <Svg d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2l-4-4" />;
export const PulseIcon = () => <Svg d="M3 12h4l3-7 4 14 3-7h4" />;
export const ThinkIcon = () => <Svg d="M12 3a6 6 0 0 0-4 10.5V17h8v-3.5A6 6 0 0 0 12 3zM9 21h6" />;
