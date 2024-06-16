from PIL import Image

BOX = tuple[float, float, float, float]
def get_patches(image : Image.Image, grid_size: int) -> list[tuple[BOX, Image.Image]]:
    # given grid_size divide image into grid_size x grid_size patches
    # return list of patches
    
    width, height = image.size
    patch_width = width // grid_size
    patch_height = height // grid_size
    
    patches = []
    for i in range(grid_size):
        for j in range(grid_size):
            left = i * patch_width
            upper = j * patch_height
            right = left + patch_width
            lower = upper + patch_height
            patch = image.crop((left, upper, right, lower))
            patches.append(((left / width, upper / height, right / width, lower / height), patch))
                        
    return patches


def get_overlay_patches(image: Image.Image, grid_size: int, cpr: float) -> list[tuple[BOX, Image.Image]]:
    # given image, grid_size and cpr
    # divide image into grid, but each patch is moving on grid_size * cpr
    # return list of patches
    
    width, height = image.size
    patch_width = width // grid_size
    patch_height = height // grid_size
    
    patches = []
    i, j = 0, 0
    while i + patch_width * .5 <= width:
        while j + patch_height * .5 <= height:
            left = i
            upper = j
            right = left + patch_width 
            lower = upper + patch_height
            patch = image.crop((left, upper, right, lower))
            patches.append(((left / width, upper / height, right / width, lower / height), patch))
            j += int(patch_height * cpr)
        i += int(patch_width * cpr)
        j = 0
        
    return patches