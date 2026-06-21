import Image from "next/image";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
};

export function BrandLockup({ compact = false, className = "" }: BrandLockupProps) {
  const dcerLogoClass = compact ? "h-10 w-auto" : "h-14 w-auto sm:h-16";
  const insigniaClass = compact ? "h-10 w-10" : "h-14 w-14 sm:h-16 sm:w-16";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="rounded-md bg-white p-2 shadow-sm ring-1 ring-[#d8def0]">
        <Image
          src="/brand/dcer-paulista-logo.png"
          alt="DCER Paulista"
          width={680}
          height={373}
          priority={!compact}
          className={`${dcerLogoClass} object-contain`}
        />
      </div>
      <Image
        src="/brand/embaixadores-rei-insignia.png"
        alt="Insignia dos Embaixadores do Rei"
        width={512}
        height={512}
        priority={!compact}
        className={`${insigniaClass} shrink-0 object-contain`}
      />
    </div>
  );
}
