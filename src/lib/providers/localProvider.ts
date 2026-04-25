import { extractFaceDescriptor, extractAllFaces } from '../faceApi';
export { extractFaceDescriptor, extractAllFaces };
import { supabase } from '../supabaseClient';

export const localProvider = {
  async extractAndStore(imgElement: HTMLImageElement, photoId: string, isFastSelection: boolean = false) {
    const faces = await extractAllFaces(imgElement);
    if (faces && faces.length > 0) {
      const faceRecords = faces.map(f => ({
        photo_id: photoId,
        face_descriptor: `[${Array.from(f.descriptor).join(',')}]`
      }));
      
      const targetTable = isFastSelection ? 'fast_selection_photo_faces' : 'photo_faces';
      const { error: faceError } = await supabase.from(targetTable).insert(faceRecords);
      
      if (faceError) {
        console.error(`Local face extraction failed to save to ${targetTable}:`, faceError);
      }
    }
  },

  async findSimilarFaces(selfieDescriptor: Float32Array) {
    const vectorString = `[${Array.from(selfieDescriptor).join(',')}]`;
    const { data: matches, error } = await supabase.rpc('match_faces', {
      query_embedding: vectorString,
      match_threshold: 0.6,
      match_count: 50
    });

    if (error) throw error;
    return matches || [];
  }
};
