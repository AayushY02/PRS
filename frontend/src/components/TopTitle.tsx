type Props = { title: string; subtitle?: string; right?: React.ReactNode };
export default function TopTitle({ title, subtitle, right }: Props) {
  return (
    <div className="pt-4 pb-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
    </div>
  );
}
