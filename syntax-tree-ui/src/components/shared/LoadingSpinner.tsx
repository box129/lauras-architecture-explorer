export default function LoadingSpinner({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className="border-2 border-border border-t-accent rounded-full"
        style={{
          width: size,
          height: size,
          animation: 'spin 0.8s linear infinite',
        }}
      />
    </div>
  );
}
