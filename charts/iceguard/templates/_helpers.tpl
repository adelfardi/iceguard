{{/*
Name helpers
*/}}
{{- define "iceguard.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "iceguard.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "iceguard.backend.fullname" -}}
{{- printf "%s-backend" (include "iceguard.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "iceguard.frontend.fullname" -}}
{{- printf "%s-frontend" (include "iceguard.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "iceguard.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Labels. `iceguard.labels` takes a dict {ctx, component}; selector labels are the
stable subset (never include the chart/app version, which changes on upgrade).
*/}}
{{- define "iceguard.selectorLabels" -}}
app.kubernetes.io/name: {{ include "iceguard.name" .ctx }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "iceguard.labels" -}}
{{ include "iceguard.selectorLabels" . }}
helm.sh/chart: {{ include "iceguard.chart" .ctx }}
app.kubernetes.io/version: {{ .ctx.Chart.AppVersion | quote }}
app.kubernetes.io/part-of: iceguard
app.kubernetes.io/managed-by: {{ .ctx.Release.Service }}
{{- with .ctx.Values.commonLabels }}
{{ toYaml . }}
{{- end }}
{{- end }}

{{- define "iceguard.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "iceguard.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Images. Component values win; otherwise <image.registry>/iceguard-<component>:<tag>,
with the chart appVersion as the last-resort tag.
*/}}
{{- define "iceguard.image" -}}
{{- $comp := index .ctx.Values .component -}}
{{- $repo := $comp.image.repository | default (printf "%s/iceguard-%s" (trimSuffix "/" .ctx.Values.image.registry) .component) -}}
{{- $tag := $comp.image.tag | default .ctx.Values.image.tag | default .ctx.Chart.AppVersion -}}
{{- printf "%s:%s" $repo $tag -}}
{{- end }}

{{- define "iceguard.imagePullPolicy" -}}
{{- $comp := index .ctx.Values .component -}}
{{- $comp.image.pullPolicy | default .ctx.Values.image.pullPolicy -}}
{{- end }}

{{/*
Database wiring — always the user's own PostgreSQL (`.Values.database`).
*/}}
{{- define "iceguard.db.jdbcUrl" -}}
{{- with .Values.database -}}
{{- if .jdbcUrl -}}
{{ .jdbcUrl }}
{{- else -}}
{{ printf "jdbc:postgresql://%s:%v/%s" .host (.port | toString) .name }}
{{- end -}}
{{- end -}}
{{- end }}

{{/*
Where the credentials live: the user's existingSecret, or the one this chart creates
from the inline password.
*/}}
{{- define "iceguard.db.secretName" -}}
{{- if .Values.database.existingSecret -}}
{{ .Values.database.existingSecret }}
{{- else -}}
{{ printf "%s-db" (include "iceguard.fullname" .) }}
{{- end -}}
{{- end }}

{{- define "iceguard.db.passwordKey" -}}
{{ .Values.database.passwordKey | default "password" }}
{{- end }}

{{/*
Username env: read from the secret when the user says which key holds it, otherwise
inline the plain value.
*/}}
{{- define "iceguard.db.usernameEnv" -}}
{{- if and .Values.database.existingSecret .Values.database.usernameKey -}}
valueFrom:
  secretKeyRef:
    name: {{ .Values.database.existingSecret }}
    key: {{ .Values.database.usernameKey }}
{{- else -}}
value: {{ .Values.database.username | quote }}
{{- end -}}
{{- end }}

{{- define "iceguard.db.passwordEnv" -}}
valueFrom:
  secretKeyRef:
    name: {{ include "iceguard.db.secretName" . }}
    key: {{ include "iceguard.db.passwordKey" . }}
{{- end }}

{{/*
True when the chart knows a host:port to TCP-probe before starting the backend.
*/}}
{{- define "iceguard.db.hostKnown" -}}
{{- if .Values.database.host -}}true{{- end -}}
{{- end }}

{{- define "iceguard.imagePullSecrets" -}}
{{- with .Values.image.pullSecrets }}
imagePullSecrets:
{{ toYaml . }}
{{- end }}
{{- end }}
