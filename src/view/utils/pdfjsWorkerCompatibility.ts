/**
 * Необходимо для корректной работы в сафари, без полифиллов pdf не будет отображаться
 * Дополнительно для этой же цели legacy-build для воркера
 */

import './pdfjsCompatibility.ts';
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
