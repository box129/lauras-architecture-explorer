import { lazy, Suspense } from 'react';
import { useSyntaxTreeStore } from '../../store';
import { useFileContent } from '../../api/hooks';
import FileTabs from './FileTabs';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorBanner from '../shared/ErrorBanner';
import { FileCode2 } from 'lucide-react';

const MonacoWrapper = lazy(() => import('./MonacoWrapper'));

export default function CodeViewer() {
  const openFilePath = useSyntaxTreeStore((s) => s.openFilePath);
  const openFileLine = useSyntaxTreeStore((s) => s.openFileLine);
  const openFileLineEnd = useSyntaxTreeStore((s) => s.openFileLineEnd);
  const { data, loading, error, refetch } = useFileContent(openFilePath);

  return (
    <div className="h-full flex flex-col">
      <FileTabs />

      {!openFilePath ? (
        <div className="flex-1 flex flex-col items-center justify-center text-secondary gap-3">
          <FileCode2 size={40} className="opacity-30" />
          <p className="text-sm">Select a file or click a node to view code</p>
        </div>
      ) : loading ? (
        <LoadingSpinner className="flex-1" size={28} />
      ) : error ? (
        <div className="flex-1 p-4">
          <ErrorBanner message={error} onRetry={refetch} />
        </div>
      ) : data ? (
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingSpinner className="flex-1" size={28} />}>
            <MonacoWrapper fileContent={data} targetLine={openFileLine} targetLineEnd={openFileLineEnd} />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
