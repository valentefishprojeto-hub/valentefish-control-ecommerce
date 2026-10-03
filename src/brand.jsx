export function BrandLockup({layout='horizontal',className=''}){
  return (
    <span className={`brand-lockup brand-lockup-${layout} ${className}`.trim()}>
      <img src="/valente-fish-logo.png" alt="Valente Fish"/>
    </span>
  );
}
