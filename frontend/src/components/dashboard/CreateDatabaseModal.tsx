'use client';

import { useState, useEffect } from 'react';
import { X, Database as DatabaseIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDatabasesStore } from '@/store/databasesStore';
import { useProjectsStore } from '@/store/projectsStore';
import { DatabaseType } from '@/types';

interface CreateDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedProjectId?: string;
}

export function CreateDatabaseModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedProjectId,
}: CreateDatabaseModalProps) {
  const { createDatabase, isLoading, error } = useDatabasesStore();
  const { projects, fetchProjects } = useProjectsStore();

  const [formData, setFormData] = useState({
    name: '',
    type: 'MYSQL' as DatabaseType,
    projectId: preselectedProjectId || '',
    username: '',
    password: '',
    autoGenerateCredentials: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && projects.length === 0) {
      fetchProjects();
    }
  }, [isOpen, projects.length, fetchProjects]);

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        type: 'MYSQL',
        projectId: preselectedProjectId || '',
        username: '',
        password: '',
        autoGenerateCredentials: true,
      });
      setErrors({});
    }
  }, [isOpen, preselectedProjectId]);

  const generatePassword = () => {
    const length = 16;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleGeneratePassword = () => {
    setFormData((prev) => ({
      ...prev,
      password: generatePassword(),
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Database name is required';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.name)) {
      newErrors.name = 'Only letters, numbers, underscores, and hyphens allowed';
    }

    if (!formData.projectId) {
      newErrors.projectId = 'Please select a project';
    }

    if (!formData.autoGenerateCredentials) {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      }
      if (!formData.password.trim()) {
        newErrors.password = 'Password is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const data: any = {
        name: formData.name,
        type: formData.type,
        projectId: formData.projectId,
      };

      if (!formData.autoGenerateCredentials) {
        data.username = formData.username;
        data.password = formData.password;
      }

      await createDatabase(data);

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to create database:', error);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const databaseTypes = [
    { value: 'MYSQL', label: 'MySQL 8.0', icon: '🐬', description: 'Popular relational database' },
    { value: 'POSTGRESQL', label: 'PostgreSQL 15', icon: '🐘', description: 'Advanced relational database' },
    { value: 'MONGODB', label: 'MongoDB 6', icon: '🍃', description: 'NoSQL document database' },
    { value: 'REDIS', label: 'Redis 7', icon: '⚡', description: 'In-memory data store' },
    { value: 'SQLITE', label: 'SQLite', icon: '📁', description: 'Lightweight file-based database' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <DatabaseIcon className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold text-foreground">
              Create Database
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Database Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Database Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="my_database"
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Use lowercase letters, numbers, underscores, and hyphens only
            </p>
          </div>

          {/* Database Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Database Type <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {databaseTypes.map((db) => (
                <label
                  key={db.value}
                  className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.type === db.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-border dark:hover:border-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={db.value}
                    checked={formData.type === db.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3 w-full">
                    <span className="text-2xl">{db.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {db.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {db.description}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="projectId">
              Project <span className="text-destructive">*</span>
            </Label>
            <select
              id="projectId"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                errors.projectId
                  ? 'border-destructive'
                  : 'border-border'
              }`}
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.slug})
                </option>
              ))}
            </select>
            {errors.projectId && (
              <p className="text-sm text-destructive">
                {errors.projectId}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              The database will be associated with this project
            </p>
          </div>

          {/* Credentials Section */}
          <div className="border-t border-border pt-6">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="autoGenerateCredentials"
                name="autoGenerateCredentials"
                checked={formData.autoGenerateCredentials}
                onChange={handleChange}
                className="rounded border-border"
              />
              <Label htmlFor="autoGenerateCredentials" className="cursor-pointer">
                Auto-generate secure credentials (Recommended)
              </Label>
            </div>

            {!formData.autoGenerateCredentials && (
              <div className="space-y-4 pl-7">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder="db_user"
                    className={errors.username ? 'border-destructive' : ''}
                  />
                  {errors.username && (
                    <p className="text-sm text-destructive">
                      {errors.username}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="password"
                      name="password"
                      type="text"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Password sicura"
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGeneratePassword}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-primary mb-2">
              What happens when you create a database?
            </h4>
            <ul className="text-xs text-primary space-y-1 list-disc list-inside">
              <li>A dedicated Docker container will be created</li>
              <li>Credentials will be securely encrypted</li>
              <li>The database will be accessible on localhost</li>
              <li>Data will be persisted in Docker volumes</li>
              <li>You'll receive a connection string to use in your app</li>
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creazione...' : 'Crea Database'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
