'use client';

import {

  RefreshCw,
  Upload,
  FolderPlus,
  Home,
  ChevronRight,
  Search,
  Table as TableIcon,
  List,
  Trash2,
  Copy,
  Scissors,
  HelpCircle,
  ClipboardPaste,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FileTableView } from './FileTableView';
import { FileTreeView } from './FileTreeView';
import {
  KeyboardHelpModal,
  PreviewModal,
  UploadModal,
  NewFolderModal,
  EditFileModal,
  ExtractModal,
} from './FileManagerModals';
import { useFileManager } from './useFileManager';

export default function FileManagerPage() {
  const fm = useFileManager();

  // --- Render ---
  if (fm.loading && fm.currentItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">File Manager</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => fm.setViewMode(fm.viewMode === 'table' ? 'tree' : 'table')} variant="outline" size="sm">
              {fm.viewMode === 'table' ? (
                <><List className="h-4 w-4 mr-2" />Vista Albero</>
              ) : (
                <><TableIcon className="h-4 w-4 mr-2" />Vista Tabella</>
              )}
            </Button>
            <Button onClick={fm.loadRoot} variant="outline" size="sm" title="Ricarica">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => fm.setShowKeyboardHelp(!fm.showKeyboardHelp)} variant="outline" size="sm" title="Aiuto scorciatoie tastiera">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Breadcrumbs */}
        <Card className="bg-muted/30">
          <CardContent className="py-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {fm.getBreadcrumbs().map((crumb, index, arr) => (
                  <div key={crumb.path} className="flex items-center gap-2">
                    <button
                      onClick={() => fm.loadDirectory(crumb.path)}
                      className="px-3 py-1.5 rounded-md hover:bg-primary/10 hover:text-primary transition-all duration-200 font-medium flex items-center gap-2"
                      title={crumb.path || '/var/www'}
                    >
                      {index === 0 ? (
                        <><Home className="h-4 w-4" /><span className="text-sm">Home</span></>
                      ) : (
                        <span className="text-sm">{crumb.name}</span>
                      )}
                    </button>
                    {index < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono bg-background px-2 py-1 rounded border">
                  {fm.currentPath ? `/var/www/${fm.currentPath}` : '/var/www'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={fm.searchQuery} onChange={(e) => fm.setSearchQuery(e.target.value)} placeholder="Cerca file..." className="pl-8" />
            </div>
          </div>
          <Button onClick={() => fm.setShowNewFolderModal(true)} size="sm">
            <FolderPlus className="h-4 w-4 mr-2" />Nuova Cartella
          </Button>
          <Button onClick={() => fm.setShowUploadModal(true)} size="sm">
            <Upload className="h-4 w-4 mr-2" />Carica
          </Button>
          {fm.clipboard && (
            <Button onClick={fm.handlePaste} size="sm" variant="outline">
              <ClipboardPaste className="h-4 w-4 mr-2" />
              Incolla ({fm.clipboard.operation === 'copy' ? 'Copia' : 'Sposta'})
            </Button>
          )}
          {fm.selectedItems.size > 0 && (
            <>
            <Button onClick={fm.handleBatchDownload} size="sm" variant="outline">
              <Download className="h-4 w-4 mr-2" />Scarica ({fm.selectedItems.size})
            </Button>
            <Button onClick={fm.handleBatchCopy} size="sm" variant="outline">
              <Copy className="h-4 w-4 mr-2" />Copia ({fm.selectedItems.size})
            </Button>
            <Button onClick={fm.handleBatchCut} size="sm" variant="outline">
              <Scissors className="h-4 w-4 mr-2" />Sposta ({fm.selectedItems.size})
            </Button>
            <Button onClick={fm.handleBatchDelete} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />Elimina ({fm.selectedItems.size})
            </Button>
            </>
          )}
        </div>
      </div>

      {fm.error && (
        <Card className={fm.error.includes('Successo') ? 'border-green-500' : 'border-destructive'}>
          <CardContent className="pt-6">
            <p className={`text-sm ${fm.error.includes('Successo') ? 'text-green-600' : 'text-destructive'}`}>{fm.error}</p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      <Card
        onDragOver={fm.handleDragOver}
        onDragEnter={fm.handleDragEnter}
        onDragLeave={fm.handleDragLeave}
        onDrop={fm.handleDrop}
        className={fm.isDragging ? 'border-2 border-primary border-dashed bg-primary/5' : ''}
      >
        <CardContent className="pt-6">
          {fm.isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 rounded-lg pointer-events-none">
              <div className="bg-background/95 p-6 rounded-lg shadow-lg border-2 border-primary">
                <Upload className="h-12 w-12 mx-auto mb-2 text-primary" />
                <p className="text-lg font-semibold text-primary">Rilascia i file qui</p>
              </div>
            </div>
          )}
          {fm.viewMode === 'table' ? (
            <FileTableView
              currentItems={fm.currentItems}
              searchQuery={fm.searchQuery}
              sortField={fm.sortField}
              sortOrder={fm.sortOrder}
              selectedItems={fm.selectedItems}
              favorites={fm.favorites}
              onSort={fm.handleSort}
              onToggleSelect={fm.toggleSelectItem}
              onToggleSelectAll={fm.toggleSelectAll}
              onLoadDirectory={fm.loadDirectory}
              onEdit={fm.handleEdit}
              onDownload={fm.handleDownload}
              onPreview={fm.handlePreview}
              onDelete={fm.handleDelete}
              onCopy={fm.handleCopy}
              onCut={fm.handleCut}
              onCopyPath={fm.handleCopyPath}
              onToggleFavorite={fm.toggleFavorite}
              onExtract={fm.handleExtractAction}
            />
          ) : (
            <FileTreeView
              nodes={fm.rootItems}
              onToggleExpand={fm.toggleExpand}
              onEdit={fm.handleEdit}
              onDownload={fm.handleDownload}
              onDelete={fm.handleDelete}
              onExtract={fm.handleExtractAction}
            />
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {fm.showKeyboardHelp && <KeyboardHelpModal onClose={() => fm.setShowKeyboardHelp(false)} />}

      {fm.previewFile && (
        <PreviewModal
          file={fm.previewFile}
          content={fm.previewContent}
          type={fm.previewType}
          isLoading={fm.isLoadingContent}
          onDownload={fm.handleDownload}
          onEdit={fm.handleEdit}
          onClose={fm.closePreview}
          onError={fm.setError}
        />
      )}

      {fm.showUploadModal && (
        <UploadModal
          uploadFiles={fm.uploadFiles}
          onFilesChange={fm.setUploadFiles}
          onUpload={fm.handleUpload}
          onClose={fm.closeUploadModal}
          isUploading={fm.isUploading}
          uploadProgress={fm.uploadProgress}
        />
      )}

      {fm.showNewFolderModal && (
        <NewFolderModal
          folderName={fm.newFolderName}
          onFolderNameChange={fm.setNewFolderName}
          onCreate={fm.handleNewFolder}
          onClose={fm.closeNewFolderModal}
        />
      )}

      {fm.editingFile && (
        <EditFileModal
          file={fm.editingFile}
          content={fm.fileContent}
          isLoading={fm.isLoadingContent}
          onContentChange={fm.setFileContent}
          onSave={fm.handleSaveFile}
          onClose={fm.closeEditFile}
        />
      )}

      {fm.extractingArchive && (
        <ExtractModal
          file={fm.extractingArchive}
          destination={fm.extractDestination}
          onDestinationChange={fm.setExtractDestination}
          onExtract={fm.handleExtract}
          onClose={fm.closeExtractModal}
        />
      )}
    </div>
  );
}
