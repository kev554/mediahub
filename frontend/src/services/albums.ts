import { apiFetch } from './api'
import type { Album } from '../types/album'


export type CreateAlbumData = {

  name:string

  description?:string

  year:number

  visibility:
    | 'private'
    | 'group'

  group_id?:number|null

}



export type UpdateAlbumData = {

  name?:string

  description?:string

  year?:number

  visibility?:
    | 'private'
    | 'group'

  group_id?:number|null

}




export async function getAlbums()
:Promise<Album[]>{

  return apiFetch<Album[]>(
    '/albums',
  )

}



export async function getAlbum(
  id:number,
):Promise<Album>{

  return apiFetch<Album>(
    `/albums/${id}`,
  )

}



export async function createAlbum(
 data:CreateAlbumData,
):Promise<Album>{

 return apiFetch<Album>(
  '/albums',
  {
   method:'POST',
   body:JSON.stringify(data),
  },
 )

}



export async function updateAlbum(
 id:number,
 data:UpdateAlbumData,
):Promise<Album>{

 return apiFetch<Album>(
  `/albums/${id}`,
  {
   method:'PATCH',
   body:JSON.stringify(data),
  },
 )

}



export async function deleteAlbum(
 id:number,
):Promise<void>{

 await apiFetch<void>(
  `/albums/${id}`,
  {
   method:'DELETE',
  },
 )

}



export async function getAlbumMedia(
 id:number,
){

 return apiFetch(
  `/albums/${id}/media`,
 )

}
