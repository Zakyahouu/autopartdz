import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Layers } from 'lucide-react';
import DocumentTypesPage from './DocumentTypesPage';
import CarCategoriesPage from './CarCategoriesPage';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') === 'categories' ? 'categories' : 'documents';

  const [docCount, setDocCount] = useState(null);
  const [catCount, setCatCount] = useState(null);

  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  return (
    <div>
      {/* Catalog Hub Main Title */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="admin-page-title">Catalog Management</h1>
        <p className="admin-page-subtitle">
          Configure official customs documents, pricing structures, and vehicle category requirements.
        </p>
      </div>

      {/* Tabs Switcher */}
      <div className="admin-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'documents'}
          className={`admin-tab-btn ${currentTab === 'documents' ? 'active' : ''}`}
          onClick={() => handleTabChange('documents')}
        >
          <FileText size={16} />
          <span>Document Types</span>
          {docCount !== null && (
            <span className="admin-tab-badge">{docCount}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={currentTab === 'categories'}
          className={`admin-tab-btn ${currentTab === 'categories' ? 'active' : ''}`}
          onClick={() => handleTabChange('categories')}
        >
          <Layers size={16} />
          <span>Car Categories</span>
          {catCount !== null && (
            <span className="admin-tab-badge">{catCount}</span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {currentTab === 'documents' && (
          <DocumentTypesPage onCountChange={setDocCount} />
        )}
        {currentTab === 'categories' && (
          <CarCategoriesPage onCountChange={setCatCount} />
        )}
      </div>
    </div>
  );
}
