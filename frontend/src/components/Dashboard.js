import LoadingSpinner from './ui/LoadingSpinner';

// Replace line 894
if (loading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  );
}