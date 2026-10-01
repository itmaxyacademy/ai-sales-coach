import type { Request, Response, NextFunction } from 'express';
import { generateQuickExamples } from '../services/courseGeneratorService.js';
import { generateCompanyContext } from '../services/companyGeneratorService.js';
import { prisma } from '../lib/prisma.js';

async function safeGetCompany(companyId?: string | null) {
  if (!companyId) return null;
  try {
    return await prisma.company.findUnique({
      where: { id: companyId },
    });
  } catch (err) {
    console.warn('[AIController] Database unreachable or company lookup failed, proceeding without company context:', err instanceof Error ? err.message : err);
    return null;
  }
}


export async function generateCompanyContextHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { url, brief } = req.body;
    const file = req.file;

    if (!url && !brief && !file) {
      return res.status(400).json({ message: 'Harap sediakan URL website, file dokumen, atau brief singkat.' });
    }
    
    let companyName = "";
    let industry = "";
    
    if (req.user && req.user.companyId) {
      const company = await safeGetCompany(req.user.companyId);
      if (company) {
        companyName = company.name;
        industry = company.industry;
      }
    }
    
    const contextData = await generateCompanyContext(brief, url, companyName, industry, file);
    
    return res.json({ context: contextData });
  } catch (err) {
    next(err);
  }
}

export async function generateQuickExamplesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const companyContext = await safeGetCompany(req.user?.companyId);

    const examples = await generateQuickExamples(companyContext);
    return res.json({ examples });
  } catch (err) {
    next(err);
  }
}

export async function courseClarificationHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { brief, industry, productName, targetPersona } = req.body;
    const file = req.file;

    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      return res.status(400).json({ message: 'Brief terlalu pendek. Minimal 5 karakter.' });
    }

    let documentText = '';
    if (file) {
      try {
        const { env } = await import('../config/env.js');
        const scraperUrl = env.SCRAPER_PYTHON_URL.replace(/\/$/, '');
        const formData = new FormData();
        formData.append('file', new Blob([file.buffer as unknown as BlobPart], { type: 'application/octet-stream' }), file.originalname || 'brosur.pdf');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const scraperRes = await fetch(`${scraperUrl}/extract-file`, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (scraperRes.ok) {
          const scraperData = await scraperRes.json();
          documentText = scraperData.text || '';
        }
      } catch (err) {
        console.warn('Scraper extraction notice (proceeding with brief):', err);
      }
    }

    const companyContext = await safeGetCompany(req.user?.companyId);

    const { generateCourseClarifications } = await import('../services/courseGeneratorService.js');
    const clarificationData = await generateCourseClarifications({
      brief: brief.trim(),
      industry,
      productName,
      targetPersona,
      documentText,
      companyContext,
    });

    return res.json({
      ...clarificationData,
      documentText: documentText ? documentText.slice(0, 4000) : undefined,
    });
  } catch (err) {
    next(err);
  }
}

export async function generateCourseConfirmedHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { brief, industry, productName, targetPersona, clarifications, documentText } = req.body;

    if (!brief || typeof brief !== 'string' || brief.trim().length < 5) {
      return res.status(400).json({ message: 'Brief terlalu pendek. Minimal 5 karakter.' });
    }

    const companyContext = await safeGetCompany(req.user?.companyId);

    const { generateCourseFromConfirmedBrief } = await import('../services/courseGeneratorService.js');
    const courseData = await generateCourseFromConfirmedBrief({
      brief: brief.trim(),
      industry,
      productName,
      targetPersona,
      clarifications: Array.isArray(clarifications) ? clarifications : [],
      documentText,
      companyContext,
    });

    return res.json({
      course: courseData,
      documentContextSaved: Boolean(documentText && documentText.length > 50),
    });
  } catch (err) {
    next(err);
  }
}

export async function regenerateCourseSectionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { sectionKey, currentCourse, instruction } = req.body;

    if (!sectionKey || !currentCourse) {
      return res.status(400).json({ message: 'sectionKey dan currentCourse wajib disediakan.' });
    }

    const { regenerateCourseSection } = await import('../services/courseGeneratorService.js');
    const result = await regenerateCourseSection({
      sectionKey,
      currentCourse,
      instruction,
    });

    return res.json(result);
  } catch (err) {
    next(err);
  }
}
