import Image from "next/image";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLockup({ compact = false, className = "" }: BrandLockupProps) {
  const dcerLogoClass = compact ? "h-9 w-auto" : "h-14 w-auto sm:h-16";
  const insigniaClass = compact ? "h-9 w-9" : "h-14 w-14 sm:h-16 sm:w-16";
  const mrLogoClass = compact ? "h-9 w-10" : "h-14 w-16 sm:h-16 sm:w-[4.5rem]";
  const layoutClass = compact ? "flex-nowrap gap-2" : "flex-wrap gap-3";

  return (
    <div className={`flex items-center ${layoutClass} ${className}`}>
      <Image
        src="/brand/dcer-paulista-logo.png"
        alt="DCER Paulista"
        width={680}
        height={373}
        unoptimized
        priority={!compact}
        className={`${dcerLogoClass} shrink-0 object-contain`}
      />
      <Image
        src="/brand/embaixadores-rei-insignia.png"
        alt="Insignia dos Embaixadores do Rei"
        width={512}
        height={512}
        unoptimized
        priority={!compact}
        className={`${insigniaClass} shrink-0 object-contain`}
      />
      <Image
        src="/brand/mensageiras-rei-logo.png"
        alt="Logo das Mensageiras do Rei"
        width={399}
        height={360}
        unoptimized
        priority={!compact}
        className={`${mrLogoClass} shrink-0 object-contain`}
      />
    </div>
  );
}
