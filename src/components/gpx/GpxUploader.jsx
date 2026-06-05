import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

export default function GpxUploader({ onFiles, loading }) {
  const onDrop = useCallback((accepted) => {
    const gpxFiles = accepted.filter((f) => f.name.toLowerCase().endsWith('.gpx'))
    if (gpxFiles.length > 0) onFiles(gpxFiles)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/gpx+xml': ['.gpx'], 'text/xml': ['.gpx'], 'application/xml': ['.gpx'] },
    multiple: true,
    disabled: loading,
  })

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${isDragActive ? '#2196F3' : '#ccc'}`,
        borderRadius: 8,
        padding: '20px 16px',
        textAlign: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        background: isDragActive ? '#e3f2fd' : '#fafafa',
        transition: 'all 0.2s',
        marginBottom: 12,
      }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: 28, marginBottom: 4 }}>📂</div>
      {isDragActive
        ? <p style={{ margin: 0, color: '#2196F3', fontWeight: 600 }}>Deixa els fitxers aquí</p>
        : <p style={{ margin: 0, color: '#666', fontSize: 14 }}>
            Arrossega fitxers <strong>.gpx</strong> o fes clic per seleccionar
          </p>
      }
    </div>
  )
}
