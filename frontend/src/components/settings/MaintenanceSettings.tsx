'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, Square, RefreshCw, PlayCircle, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'

interface MaintenanceTask {
  id: string
  name: string
  description: string
}

interface MaintenanceStatus {
  enabled: boolean
  schedule: string
  lastRun: string | null
  lastReport: any
  tasks: MaintenanceTask[]
}

export function MaintenanceSettings() {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set())
  const [runningAll, setRunningAll] = useState(false)
  const [schedulerAction, setSchedulerAction] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setError(null)
      const response = await api.get('/maintenance/status')
      setStatus(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }

  const handleSchedulerAction = async (action: 'start' | 'stop' | 'restart') => {
    setSchedulerAction(action)
    try {
      await api.post(`/maintenance/scheduler/${action}`)
      toast.success(action === 'start' ? 'Scheduler avviato' : action === 'stop' ? 'Scheduler fermato' : 'Scheduler riavviato')
      await fetchStatus()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Errore')
    } finally {
      setSchedulerAction(null)
    }
  }

  const handleRunAll = async () => {
    setRunningAll(true)
    try {
      const response = await api.post('/maintenance/run')
      const report = response.data.data
      const succeeded = report?.results?.filter((r: any) => r.success).length || 0
      const total = report?.results?.length || 0
      toast.success(`${succeeded}/${total} task completate`)
      await fetchStatus()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Errore')
    } finally {
      setRunningAll(false)
    }
  }

  const handleRunTask = async (taskId: string) => {
    setRunningTasks(prev => new Set(prev).add(taskId))
    try {
      const response = await api.post(`/maintenance/run/${taskId}`)
      if (response.data.success) {
        toast.success(response.data.message)
      } else {
        toast.error(response.data.message)
      }
      await fetchStatus()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Errore')
    } finally {
      setRunningTasks(prev => { const n = new Set(prev); n.delete(taskId); return n })
    }
  }

  const formatDate = (dateString: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(dateString))

  if (loading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>

  if (error) return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{error} <Button variant="link" onClick={fetchStatus} className="ml-2 p-0 h-auto">Riprova</Button></AlertDescription>
    </Alert>
  )

  if (!status) return <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Nesun dato</AlertDescription></Alert>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduler Manutenzione</CardTitle>
              <CardDescription>Schedule: <code className="bg-muted px-2 py-1 rounded">{status.schedule}</code></CardDescription>
            </div>
            <Badge variant={status.enabled ? 'default' : 'secondary'}>{status.enabled ? 'Attivo' : 'Disabilitato'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">Ultima esecuzione: {status.lastRun ? formatDate(status.lastRun) : 'Mai'}</div>
          <div className="flex gap-2">
            <Button onClick={() => handleSchedulerAction('start')} disabled={schedulerAction !== null} size="sm">
              {schedulerAction === 'start' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}Avvia
            </Button>
            <Button onClick={() => handleSchedulerAction('stop')} disabled={schedulerAction !== null} variant="destructive" size="sm">
              {schedulerAction === 'stop' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}Ferma
            </Button>
            <Button onClick={() => handleSchedulerAction('restart')} disabled={schedulerAction !== null} variant="outline" size="sm">
              {schedulerAction === 'restart' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Riavvia
            </Button>
            <Button onClick={fetchStatus} variant="ghost" size="sm"><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div><CardTitle>Task di Manutenzione</CardTitle><CardDescription>{(status.tasks || []).length} task</CardDescription></div>
            <Button onClick={handleRunAll} disabled={runningAll} size="sm">
              {runningAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}Esegui Tutte
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Descrizione</TableHead><TableHead className="text-right">Azioni</TableHead></TableRow></TableHeader>
            <TableBody>
              {(status.tasks || []).map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.name}</TableCell>
                  <TableCell className="text-muted-foreground">{task.description}</TableCell>
                  <TableCell className="text-right">
                    <Button onClick={() => handleRunTask(task.id)} disabled={runningTasks.has(task.id)} variant="outline" size="sm">
                      {runningTasks.has(task.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {status.lastReport && (
        <Card>
          <CardHeader>
            <CardTitle>Ultimo Report</CardTitle>
            <CardDescription>Spazio liberato: {status.lastReport.totalFreedSpace || '0 B'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Stato</TableHead><TableHead>Risultato</TableHead></TableRow></TableHeader>
              <TableBody>
                {status.lastReport.results?.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{r.task}</TableCell>
                    <TableCell>{r.success ? <Badge className="bg-success"><CheckCircle2 className="mr-1 h-3 w-3" />OK</Badge> : <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Errore</Badge>}</TableCell>
                    <TableCell className="text-sm">{r.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
