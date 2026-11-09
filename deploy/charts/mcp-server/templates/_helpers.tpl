{{- define "svc.labels" -}}
app: {{ .Chart.Name }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/part-of: kubecon-pq-agent
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
{{- end }}
