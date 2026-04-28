import './ToggleSwitch.css';

export default function ToggleSwitch({ checked, onChange, label, id }) {
  return (
    <label className="toggle-wrapper" htmlFor={id}>
      <div className={`toggle-track ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}
